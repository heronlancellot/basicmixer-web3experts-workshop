// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

// ============================================================
// 📖 WORKSHOP: BasicMixer - Contrato Principal
// ============================================================
// Este contrato implementa um "privacy pool" de denominacao fixa.
// Funciona como uma "caixa preta": usuarios depositam 0.01 ETH e
// recebem um "recibo secreto". Depois, podem sacar 0.01 ETH para
// QUALQUER endereco, sem que ninguem consiga ligar o deposito
// ao saque - gracas a provas de conhecimento zero (ZK proofs).
//
// Fluxo:
//   1. DEPOSIT: usuario gera secret+nullifier localmente,
//      calcula commitment = Poseidon(secret, nullifier),
//      e envia o commitment + 0.01 ETH ao contrato.
//   2. O contrato insere o commitment numa Merkle Tree.
//   3. WITHDRAW: usuario gera uma prova ZK que diz:
//      "eu conheco um secret+nullifier cujo commitment esta
//       nesta Merkle Tree" - sem revelar QUAL commitment e.
//   4. O contrato verifica a prova e envia 0.01 ETH ao destinatario.
// ============================================================

/**
 * =================================================
 * PRIVATE ETH POOL (POSEIDON)
 * =================================================
 * - Fixed denomination: 0.01 ETH (for testing purposes)
 * - Commit / Withdraw model
 * - Poseidon-based Merkle Tree (BN254)
 * - Nullifiers to prevent double spending
 * - Noir-compatible
 * - Sanctions (if necessary)
 * - Emergency Pausing (if necessary)
 */

// 🔑 CONCEITO: OpenZeppelin
// Usamos 3 contratos base do OpenZeppelin para seguranca:
// - Pausable: permite pausar o contrato em emergencias
// - Ownable: apenas o dono pode executar funcoes administrativas
// - ReentrancyGuard: previne ataques de reentrancia em transferencias de ETH
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.6.1/contracts/utils/Pausable.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.6.1/contracts/access/Ownable.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.6.1/contracts/utils/ReentrancyGuard.sol";


// 🔑 CONCEITO: Interface do Verificador ZK
// Este contrato e gerado automaticamente pelo compilador Noir/Barretenberg.
// Ele verifica se uma prova de conhecimento zero e valida.
// O contrato principal delega a verificacao para ca.
interface IVerifier {
    function verify(
        bytes calldata proof,
        bytes32[] calldata publicInputs
    ) external view returns (bool);
}

// 🔑 CONCEITO: Interface Poseidon
// Poseidon e uma funcao de hash "ZK-friendly" - muito mais eficiente
// dentro de circuitos ZK do que keccak256 (o hash padrao do Ethereum).
// Usamos aridade 2 (recebe 2 inputs) para construir a Merkle Tree.
// O contrato Poseidon e deployado separadamente via bytecode.
interface IPoseidonT2 {
    function poseidon(uint256[2] calldata input) external pure returns (uint256);
}

contract BasicMixer is Pausable, Ownable, ReentrancyGuard {
    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error InvalidDenomination();
    error TreeIsFull();
    error NullifierAlreadyUsed();
    error UnknownRoot();
    error InvalidProof();

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    // ⚙️ COMO FUNCIONA: Eventos
    // Eventos sao emitidos quando acoes importantes acontecem.
    // O indexer (Ponder) escuta esses eventos para construir
    // um banco de dados dos depositos e saques.

    /// @notice Emitted when a deposit is made
    /// @param commitment Commitment hash of secret and nullifier
    /// @param leafIndex Index of the commitment in the Merkle tree
    event Deposit(bytes32 indexed commitment, uint32 leafIndex);

    /// @notice Emitted when a withdrawal occurs
    /// @param recipient Address receiving the ETH
    /// @param nullifierHash Nullifier hash of the withdrawn commitment
    event Withdrawal(address indexed recipient, bytes32 nullifierHash);

    /// @notice Emitted when an address is blacklisted
    /// @param blacklistedAddress Address that was blacklisted
    event Blacklisted(address blacklistedAddress);

    /// @notice Emitted when an address is pardoned
    /// @param pardonedAddress Address that was removed from blacklist
    event Pardoned(address pardonedAddress);

    /*//////////////////////////////////////////////////////////////
                              CONSTANTS
    //////////////////////////////////////////////////////////////*/

    // 🔑 CONCEITO: Denominacao Fixa
    // TODOS os depositos sao do MESMO valor (0.01 ETH).
    // Isso e essencial para privacidade: se depositos tivessem valores
    // diferentes, seria facil rastrear "quem depositou 0.013 ETH e
    // depois sacou 0.013 ETH". Com valor fixo, todos os depositos
    // sao indistinguiveis.
    uint256 public constant DENOMINATION = 0.01 ether;

    // 🔑 CONCEITO: Profundidade da Merkle Tree
    // Uma arvore binaria de profundidade 20 suporta 2^20 = 1.048.576 folhas.
    // Cada folha e um commitment de deposito.
    uint32  public constant TREE_DEPTH   = 20;
    uint32  public constant MAX_LEAVES   = uint32(1 << TREE_DEPTH);

    /*//////////////////////////////////////////////////////////////
                          ZK / MERKLE STATE
    //////////////////////////////////////////////////////////////*/

    // ⚙️ COMO FUNCIONA: Estado da Merkle Tree
    // A Merkle Tree e uma estrutura de dados que permite provar
    // que um elemento pertence a um conjunto, sem revelar qual elemento e.
    //
    // verifier: contrato que verifica provas ZK (gerado pelo Noir)
    // poseidon: contrato que calcula hashes Poseidon on-chain
    IVerifier public immutable verifier;
    IPoseidonT2 public immutable poseidon;

    // 🔑 CONCEITO: Merkle Tree Incremental
    // Em vez de recalcular TODA a arvore a cada deposito (custaria muito gas),
    // usamos uma Merkle Tree "incremental":
    //
    // zeros[i]: valor padrao ("zero") para o nivel i da arvore.
    //           Quando nao ha folha preenchida, usamos esse valor.
    //
    // filledSubtrees[i]: o ultimo no preenchido no lado esquerdo do nivel i.
    //                    Isso permite inserir uma nova folha atualizando
    //                    apenas os nos no caminho da folha ate a raiz (20 hashes),
    //                    em vez de recalcular a arvore inteira.
    bytes32[TREE_DEPTH] public zeros;
    bytes32[TREE_DEPTH] public filledSubtrees;

    // currentRoot: a raiz atual da Merkle Tree (muda a cada deposito)
    // nextIndex: posicao da proxima folha a ser inserida
    bytes32 public currentRoot;
    uint32  public nextIndex;

    // 🔑 CONCEITO: Nullifier - prevencao de double-spend
    // Cada deposito tem um nullifier unico. Quando o usuario saca,
    // ele revela o hash do nullifier (sem revelar o nullifier em si).
    // O contrato marca esse hash como "usado" para impedir que o
    // mesmo deposito seja sacado duas vezes.
    mapping(bytes32 => bool) public nullifierHashes;

    // 🔑 CONCEITO: Raizes conhecidas
    // Guardamos TODAS as raizes historicas da arvore.
    // Isso e necessario porque entre o momento que o usuario gera a prova
    // e o momento que a transacao e minerada, outros depositos podem ter
    // mudado a raiz. Aceitando raizes historicas, evitamos que provas
    // validas sejam rejeitadas por timing.
    mapping(bytes32 => bool) public knownRoots;

    // Lista de enderecos bloqueados (compliance regulatorio)
    mapping(address => bool) public isBlacklisted;

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    // ⚙️ COMO FUNCIONA: Inicializacao da Merkle Tree
    // 1. Calcula o "zero" base: Poseidon(0, 0)
    // 2. Para cada nivel, calcula: zero[i] = Poseidon(zero[i-1], zero[i-1])
    // 3. Inicializa filledSubtrees com esses zeros
    // 4. A raiz inicial e o zero do ultimo nivel
    //
    // Isso cria uma arvore "vazia" onde todas as folhas sao zero.

    /**
    * @notice Initializes the private pool with verifier and Poseidon hash contract
    * @param _verifier Address of the ZK proof verifier contract
    * @param _poseidon Address of the Poseidon hash contract
    */

    constructor(address _verifier, address _poseidon) Ownable(msg.sender) {
        verifier = IVerifier(_verifier);
        poseidon = IPoseidonT2(_poseidon);

        // zero = Poseidon(0, 0)
        uint256 zero = poseidon.poseidon([uint256(0), uint256(0)]);
        zeros[0] = bytes32(zero);

        // Build zero tree
        // Cada nivel: zero[i] = Poseidon(zero[i-1], zero[i-1])
        for (uint32 i = 1; i < TREE_DEPTH; i++) {
            zero = poseidon.poseidon([zero, zero]);
            zeros[i] = bytes32(zero);
        }

        // Inicializa todas as subarvores preenchidas com zeros
        for (uint32 i = 0; i < TREE_DEPTH; i++) {
            filledSubtrees[i] = zeros[i];
        }

        // Raiz inicial = zero do topo da arvore
        currentRoot = zeros[TREE_DEPTH - 1];
        knownRoots[currentRoot] = true;
    }

    /*//////////////////////////////////////////////////////////////
                        REGULATORY STUFF
    //////////////////////////////////////////////////////////////*/

    // ⚙️ COMO FUNCIONA: Controle Regulatorio
    // O owner pode bloquear enderecos para compliance.
    // Enderecos bloqueados nao podem depositar nem receber saques.
    // Isso e necessario para compliance com listas de sancoes.

    /**
     * @param _address The address to be sanctioned
     */

    function blacklist(address _address) public onlyOwner {
        isBlacklisted[_address] = true;
        emit Blacklisted(_address);
    }

    /**
     * @param _address The address to be un-sanctioned
     */

    function pardon(address _address) public onlyOwner {
        isBlacklisted[_address] = false;
        emit Pardoned(_address);
    }

    /*//////////////////////////////////////////////////////////////
                        EMERGENCY STUFF
    //////////////////////////////////////////////////////////////*/

    // 💡 DICA: Pausar/Despausar
    // Em caso de vulnerabilidade descoberta, o owner pode pausar
    // o contrato imediatamente, impedindo novos depositos e saques.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /*//////////////////////////////////////////////////////////////
                                DEPOSIT
    //////////////////////////////////////////////////////////////*/

    // ============================================================
    // 📖 WORKSHOP: Funcao de Deposito
    // ============================================================
    // Esta e a funcao principal de entrada de fundos no pool.
    //
    // O usuario, no frontend:
    //   1. Gera um "secret" e um "nullifier" aleatorios
    //   2. Calcula commitment = Poseidon(secret, nullifier)
    //   3. Chama deposit(commitment) enviando 0.01 ETH
    //
    // O contrato:
    //   1. Valida o valor enviado e que o endereco nao esta bloqueado
    //   2. Insere o commitment na Merkle Tree (funcao _insert inline)
    //   3. Atualiza a raiz da arvore
    //   4. Emite evento Deposit para o indexer capturar
    //
    // ⚠️ IMPORTANTE: O usuario DEVE guardar o secret e o nullifier!
    // Sem eles, e impossivel gerar a prova ZK para sacar.
    // ============================================================

    /**
     * @notice Allows user to deposit.
     * @dev Deposit with commitment
     * Users pay exactly DENOMINATION; the full amount is withdrawable.
     * @param commitment Poseidon(secret, nullifier)
     */
    function deposit(
        bytes32 commitment
    ) external payable whenNotPaused {
        // Verifica se o endereco nao esta na blacklist
        require(!isBlacklisted[msg.sender], "this address is blacklisted and cannot deposit");

        // O usuario deve enviar exatamente DENOMINATION (0.01 ETH)
        if (msg.value != DENOMINATION) revert InvalidDenomination();
        if (nextIndex >= MAX_LEAVES) revert TreeIsFull();

        uint32 index = nextIndex;
        nextIndex++;

        // ⚙️ COMO FUNCIONA: Insercao na Merkle Tree Incremental
        // Subimos do nivel 0 (folha) ate o nivel 19 (raiz).
        // Em cada nivel:
        //   - Se o index e PAR: este no e filho ESQUERDO.
        //     Guardamos ele em filledSubtrees e combinamos com o zero do nivel.
        //   - Se o index e IMPAR: este no e filho DIREITO.
        //     Combinamos com o filledSubtree (o irmao esquerdo ja inserido).
        //   - Dividimos o index por 2 para subir ao proximo nivel.
        //
        // Isso atualiza apenas os 20 nos no caminho da folha ate a raiz,
        // em vez de recalcular toda a arvore (que teria 2^20 nos).
        uint256 currentHash = uint256(commitment);

        for (uint32 i = 0; i < TREE_DEPTH; i++) {
            // If index is even, currentHash is left child; else right child.
            // filledSubtrees[i] stores the left node at this level for future deposits.
            if ((index & 1) == 0) {
                filledSubtrees[i] = bytes32(currentHash);
                currentHash = poseidon.poseidon([
                    currentHash,
                    uint256(zeros[i])
                ]);
            } else {
                currentHash = poseidon.poseidon([
                    uint256(filledSubtrees[i]),
                    currentHash
                ]);
            }
            index >>= 1; // move up one level
        }

        // Atualiza a raiz e registra como raiz conhecida
        currentRoot = bytes32(currentHash);
        knownRoots[currentRoot] = true;

        // Emite evento que o indexer vai capturar
        emit Deposit(commitment, nextIndex - 1);
    }

    /*//////////////////////////////////////////////////////////////
                               WITHDRAW
    //////////////////////////////////////////////////////////////*/

    // ============================================================
    // 📖 WORKSHOP: Funcao de Saque (Withdraw)
    // ============================================================
    // Esta e a funcao que permite o saque anonimo.
    //
    // O usuario, no frontend:
    //   1. Reconstroi a Merkle Tree com todos os commitments
    //   2. Calcula o caminho (path) do seu commitment ate a raiz
    //   3. Gera uma prova ZK no browser (usando Noir + Barretenberg)
    //      que prova: "eu conheco um secret+nullifier valido na arvore"
    //   4. Chama withdraw(proof, root, nullifierHash, recipient)
    //
    // O contrato:
    //   1. Verifica que o nullifier nao foi usado (anti double-spend)
    //   2. Verifica que a raiz e conhecida (historico de raizes)
    //   3. Verifica a prova ZK via o contrato Verifier
    //   4. Marca o nullifier como usado
    //   5. Envia 0.01 ETH ao destinatario
    //
    // ⚠️ IMPORTANTE: A prova ZK NUNCA revela qual commitment e do usuario!
    // Ela apenas prova que EXISTE um commitment valido na arvore.
    // ============================================================

    /**
     * @notice Allows user to withdraw their funds
     * @dev Verify proof, root, nullifierHash and send funds to recipient
     * @param proof Noir proof bytes
     * @param root Merkle root
     * @param nullifierHash Poseidon(nullifier)
     * @param recipient ETH receiver
     */
    function withdraw(
        bytes calldata proof,
        bytes32 root,
        bytes32 nullifierHash,
        address payable recipient
    ) external whenNotPaused nonReentrant {
        // Verifica se o destinatario nao esta na blacklist
        require(!isBlacklisted[recipient], "recipient sanctioned");

        // Anti double-spend: cada nullifier so pode ser usado UMA vez
        if (nullifierHashes[nullifierHash]) revert NullifierAlreadyUsed();

        // A raiz usada na prova deve ser uma raiz conhecida
        if (!knownRoots[root]) revert UnknownRoot();

        // Monta os inputs publicos para o verificador
        // O circuito Noir tem 2 inputs publicos: root e nullifierHash
        bytes32[] memory publicInputs = new bytes32[](2);
        publicInputs[0] = root;
        publicInputs[1] = nullifierHash;

        // Verifica a prova ZK - se invalida, reverte
        if (!verifier.verify(proof, publicInputs)) revert InvalidProof();

        // Marca o nullifier como usado (previne double-spend)
        nullifierHashes[nullifierHash] = true;

        // Transfere 0.01 ETH ao destinatario
        (bool ok,) = recipient.call{value: DENOMINATION}("");
        require(ok, "ETH transfer failed");

        emit Withdrawal(recipient, nullifierHash);
    }

    /*//////////////////////////////////////////////////////////////
                              VIEW HELPERS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Verify if a nullifier was already used
     * @param nullifierHash Nullifier to be verified
     * @return nullifierHashes[nullifierHash] true for used nullifierHash and false otherwise
     */
    function isSpent(bytes32 nullifierHash) external view returns (bool) {
        return nullifierHashes[nullifierHash];
    }

    /**
     * @notice Checks if an address is blacklisted (sanctioned)
     * @param _address Address to be verified
     * @return isBlacklisted[_address] true for sanctioned address and false otherwise
     */
    function isAddressBlacklisted(address _address) external view returns (bool) {
        return isBlacklisted[_address];
    }

}
