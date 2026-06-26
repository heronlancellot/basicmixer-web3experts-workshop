# Parte 1: Backend (~60 min)

## Visao Geral do Protocolo

O BasicMixer e um **privacy pool de denominacao fixa**. Funciona assim:

```
DEPOSIT:
  Usuario gera secret + nullifier (aleatorios, no browser)
  ↓
  commitment = Poseidon(secret, nullifier)
  ↓
  Envia deposit(commitment) + 0.001 ETH ao contrato
  ↓
  Contrato insere commitment na Merkle Tree
  ↓
  Usuario salva a "nota" (base64 com secret + nullifier + leafIndex)

WITHDRAW:
  Usuario cola a "nota" no frontend
  ↓
  Frontend busca todos os commitments do indexer
  ↓
  Reconstroi a Merkle Tree e calcula o merkle_path
  ↓
  Gera prova ZK no browser: "eu conhego um commitment valido na arvore"
  ↓
  Envia withdraw(proof, root, nullifierHash, recipient) ao contrato
  ↓
  Contrato verifica a prova e envia 0.001 ETH ao destinatario
```

### Conceitos-Chave

| Conceito | O que e | Por que |
|----------|---------|---------|
| **Poseidon** | Funcao de hash ZK-friendly (curva BN254) | Eficiente dentro de circuitos ZK (diferente do keccak256) |
| **Merkle Tree** | Arvore binaria de hashes | Permite provar pertencimento sem revelar posicao |
| **Commitment** | `Poseidon(secret, nullifier)` | Esconde os dados do usuario |
| **Nullifier** | Valor unico por deposito | Previne double-spend sem revelar qual deposito |
| **Denominacao Fixa** | Todos os depositos = 0.001 ETH | Se valores variassem, seria facil rastrear |

---

## Secao 1: Compilar o Circuito Noir (~15 min)

### O que e o circuito?

O circuito Noir (`circuits/basicmixer/src/main.nr`) define **o que a prova ZK verifica**:

1. O usuario conhece um `secret` e `nullifier` que geram um `commitment`
2. Esse `commitment` pertence a Merkle Tree (verificado via `merkle_path`)
3. O `nullifier_hash` revelado publicamente corresponde ao `nullifier` privado

**Inputs privados** (so o usuario sabe):
- `secret`, `nullifier`, `merkle_path[20]`, `merkle_indices[20]`

**Inputs publicos** (verificados no contrato):
- `root` (raiz da Merkle Tree)
- `nullifier_hash` (Poseidon(nullifier, 0))

> Abra o arquivo `circuits/basicmixer/src/main.nr` e leia os comentarios didaticos.

### Compilar

```bash
# 1. Entrar no diretorio do circuito
cd circuits/basicmixer

# 2. Validar o circuito (verifica sintaxe e tipos)
nargo check

# 3. Executar com witness de teste (Prover.toml)
nargo execute

# 4. Gerar a verification key (--oracle_hash keccak = compativel com EVM)
bb write_vk -b ./target/basicmixer.json -o ./target --oracle_hash keccak

# 5. Gerar o contrato Solidity verificador
bb write_solidity_verifier -k ./target/vk -o ./target/Verifier.sol

# 6. (Opcional) Gerar e verificar a prova localmente antes de deployar
bb prove -b ./target/basicmixer.json -w ./target/basicmixer.gz -o ./target
bb verify -p ./target/proof -k ./target/vk
```

**Resultado:** `circuits/basicmixer/target/Verifier.sol` - contrato Solidity que verifica provas ZK.

> Este `Verifier.sol` sera deployado no proximo passo.

---

## Secao 2: Deployar os Contratos (~20 min)

### Ordem de Deploy

O deploy tem 3 etapas, nesta ordem (cada contrato depende do anterior):

```
1. Verifier.sol        ← Gerado pelo Noir/bb
2. Poseidon (bytecode) ← Gerado pelo circomlibjs
3. BasicMixer          ← Recebe enderecos do Verifier e Poseidon
```

### 2.1 Deploy do Verifier

1. Abra o [Remix IDE](https://remix.ethereum.org)
2. Crie um arquivo `Verifier.sol` e cole o conteudo de `circuits/basicmixer/target/Verifier.sol`
3. Compile com Solidity 0.8.31 (100 optimization runs recomendado)
4. Deploy na Sepolia (Injected Provider - MetaMask)
5. **Anote o endereco** do Verifier deployado

### 2.2 Deploy do Poseidon

O contrato Poseidon nao e escrito em Solidity - e gerado como bytecode puro.

1. No Remix, crie `ByteCodeDeployer.sol` e cole o conteudo de `helpers/ByteCodeDeployer.sol`
2. Compile e deploy o ByteCodeDeployer
3. Gere o bytecode do Poseidon. No console do browser (F12):

```javascript
// Instale circomlibjs se necessario: npm install circomlibjs
// Ou use este bytecode pre-gerado (Poseidon aridade 2, BN254):
const poseidonBytecode = "0x..."; // bytecode fornecido pelo instrutor
```

> O instrutor fornecera o bytecode do Poseidon. Alternativamente, gere com:
> ```javascript
> const { poseidonContract } = require("circomlibjs");
> const bytecode = poseidonContract.createCode(2);
> ```

4. Chame `ByteCodeDeployer.deploy(bytecode)` no Remix
5. No log de eventos, copie o endereco do contrato Poseidon deployado

### 2.3 Deploy do BasicMixer

1. No Remix, crie `BasicMixer.sol` e cole o conteudo de `contracts/BasicMixer.sol`
2. Compile com Solidity 0.8.31
3. Deploy com os parametros do constructor:
   - `_verifier`: endereco do Verifier (passo 2.1)
   - `_poseidon`: endereco do Poseidon (passo 2.2)
4. **Anote o endereco** do BasicMixer

> Abra o arquivo `contracts/BasicMixer.sol` e leia os comentarios didaticos para entender cada funcao.

### Testar o Contrato

No Remix, chame as seguintes funcoes de leitura:

```
currentRoot()    → deve retornar a raiz da arvore vazia
nextIndex()      → deve retornar 0 (nenhum deposito ainda)
DENOMINATION()   → deve retornar 1000000000000000 (0.001 ether em wei)
MAX_LEAVES()     → deve retornar 1048576 (2^20)
```

### Testar um Deposit

1. No campo `deposit`, coloque um commitment de teste:
   ```
   0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
   ```
2. No campo `value`, coloque `1000000000000000` (0.001 ETH em wei)
3. Clique em `deposit`
4. Verifique:
   - `nextIndex()` agora retorna `1`
   - `currentRoot()` mudou
   - O evento `Deposit` foi emitido (veja nos logs)

---

## Secao 3: Compilar e Rodar o Indexer (~20 min)

### O que e o Indexer?

O indexer escuta eventos emitidos pelo contrato na blockchain e armazena os dados em um banco de dados local. Sem ele, precisariamos escanear todos os blocos toda vez que quisessemos saber quais depositos foram feitos.

O frontend precisa de **todos os commitments** para reconstruir a Merkle Tree durante o withdraw. O indexer fornece isso via GraphQL.

> Abra os arquivos do indexer e leia os comentarios didaticos:
> - `indexer/ponder.config.ts` - configuracao de chain e contrato
> - `indexer/ponder.schema.ts` - schema das tabelas
> - `indexer/src/index.ts` - event handlers
> - `indexer/src/api/index.ts` - API GraphQL

### Configurar

Se voce deployou um novo contrato, atualize o endereco em `indexer/ponder.config.ts`:

```typescript
address: "0xSEU_ENDERECO_AQUI",
startBlock: NUMERO_DO_BLOCO_DO_DEPLOY,
```

### Compilar e Rodar

```bash
cd indexer
pnpm install
pnpm ponder dev
```

O indexer vai:
1. Conectar a Sepolia via RPC
2. Escanear blocos a partir do `startBlock`
3. Processar eventos `Deposit` e `Withdrawal`
4. Servir dados em `http://localhost:42069/graphql`

### Testar

Acesse `http://localhost:42069/graphql` no browser e faca uma query:

```graphql
{
  depositEvents(orderBy: "leafIndex", orderDirection: "asc") {
    items {
      commitment
      leafIndex
      blockNumber
    }
  }
}
```

Se voce fez o deposit de teste na secao anterior, deve ver 1 resultado.

---

## Checkpoint

Ao final da Parte 1, voce deve ter:

- [x] Circuito Noir compilado (`nargo check` OK)
- [x] Verifier.sol gerado
- [x] 3 contratos deployados na Sepolia (Verifier, Poseidon, BasicMixer)
- [x] Contrato testado (deposit funciona, eventos emitidos)
- [x] Indexer rodando localmente (`ponder dev`)
- [x] GraphQL retornando dados de depositos
- [x] **Endereco do BasicMixer anotado** (necessario para a Parte 2)

> Proximo: [FRONTEND.md](./FRONTEND.md)
