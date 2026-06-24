// ============================================================
// WORKSHOP: Circuito Noir - Prova de Conhecimento Zero
// ============================================================
// Este e o circuito ZK (Zero-Knowledge) do BasicMixer.
// Ele e compilado para WASM e roda NO BROWSER do usuario.
//
// CONCEITO: O que e uma prova ZK?
// Uma prova de conhecimento zero permite provar que voce SABE
// algo, sem revelar O QUE voce sabe.
//
// Neste caso, o usuario prova:
//   "Eu conheco um secret e um nullifier que geram um commitment
//    que esta na Merkle Tree do contrato"
// ...sem revelar QUAL commitment e dele.
//
// Isso e o que torna o protocolo privado: ninguem consegue
// ligar o saque ao deposito original.
// ============================================================

// DICA: Poseidon BN254
// Importamos a implementacao de Poseidon para a curva BN254.
// E a mesma funcao de hash usada no contrato Solidity.
// A consistencia entre circuito e contrato e CRITICA.
use poseidon::poseidon::bn254;

// Funcao auxiliar para hashear 2 campos com Poseidon
// Usada tanto para criar commitments quanto para construir a Merkle Tree.
fn hash2(left: Field, right: Field) -> Field {
    bn254::hash_2([left, right])
}

// ============================================================
// WORKSHOP: Funcao Principal do Circuito
// ============================================================
// Esta funcao define O QUE a prova ZK verifica.
// O compilador Noir transforma isso em um circuito aritmetico
// que pode ser provado/verificado criptograficamente.
// ============================================================
fn main(
    // COMO FUNCIONA: Inputs Privados vs Publicos
    //
    // Inputs PRIVADOS: so o usuario conhece. NAO sao revelados
    // na blockchain. Ficam escondidos dentro da prova.
    //
    // Inputs PUBLICOS: sao vistos por todos (no contrato).
    // O verificador confere que a prova e valida para esses inputs.

    // -------- Inputs Privados (so o usuario sabe) --------

    // secret: valor aleatorio gerado no deposit.
    //    Junto com o nullifier, forma o commitment.
    secret: Field,

    // nullifier: valor aleatorio gerado no deposit.
    //    Seu hash e revelado publicamente no withdraw para
    //    prevenir double-spend, mas o nullifier em si fica privado.
    nullifier: Field,

    // merkle_path: os 20 "irmaos" no caminho da folha ate a raiz.
    //    Necessarios para reconstruir a raiz da Merkle Tree.
    //    Exemplo: se minha folha esta na posicao 5, preciso dos
    //    nos vizinhos em cada nivel para calcular a raiz.
    merkle_path: [Field; 20],

    // merkle_indices: direcao em cada nivel (0=esquerda, 1=direita).
    //    Indica se o no atual e filho esquerdo ou direito.
    merkle_indices: [u8; 20],

    // -------- Inputs Publicos (visiveis na blockchain) --------

    // A raiz da Merkle Tree no momento do saque.
    // O contrato verifica se esta raiz e "conhecida" (knownRoots).
    root: pub Field,

    // Hash do nullifier: Poseidon(nullifier, 0).
    // Revelado publicamente para prevenir double-spend.
    // O contrato marca este hash como "usado".
    nullifier_hash: pub Field,
) {
    // ============================================================
    // PASSO 1: Calcular o commitment
    // ============================================================
    // commitment = Poseidon(secret, nullifier)
    // Este e o mesmo calculo feito no frontend durante o deposit.
    // A prova verifica que o usuario REALMENTE conhece o secret
    // e nullifier que geram este commitment.
    let commitment = hash2(secret, nullifier);

    // ============================================================
    // PASSO 2: Reconstruir a raiz da Merkle Tree
    // ============================================================
    // Partindo do commitment (folha), subimos a arvore nivel a nivel,
    // combinando com os irmaos (merkle_path) na direcao correta
    // (merkle_indices). Se chegarmos a mesma raiz publica, provamos
    // que o commitment ESTA na arvore - sem revelar em qual posicao.
    let mut current_hash = commitment;

    for i in 0..20 {
        let sibling = merkle_path[i];
        let index = merkle_indices[i];

        // index == 0 => nosso no e filho ESQUERDO (hash(nosso, irmao))
        // index == 1 => nosso no e filho DIREITO  (hash(irmao, nosso))
        current_hash = if index == 0 {
            hash2(current_hash, sibling)
        } else {
            hash2(sibling, current_hash)
        };
    }

    // ============================================================
    // PASSO 3: Verificar que a raiz calculada == raiz publica
    // ============================================================
    // Se a raiz que calculamos a partir do commitment bate com a
    // raiz publica, provamos que nosso commitment esta na arvore.
    // IMPORTANTE: assert() faz a prova FALHAR se a condicao for falsa.
    assert(current_hash == root);

    // ============================================================
    // PASSO 4: Verificar o hash do nullifier
    // ============================================================
    // nullifier_hash = Poseidon(nullifier, 0)
    // Provamos que o nullifier_hash publico corresponde ao nosso
    // nullifier privado. O contrato usa esse hash para prevenir
    // que o mesmo deposito seja sacado duas vezes.
    //
    // DICA: Por que nao revelar o nullifier diretamente?
    // Porque alguem poderia descobrir qual commitment e nosso
    // testando todos os commitments com esse nullifier.
    // O hash unidirecional protege essa informacao.
    let computed_nullifier_hash = hash2(nullifier, 0);

    assert(computed_nullifier_hash == nullifier_hash);
}
