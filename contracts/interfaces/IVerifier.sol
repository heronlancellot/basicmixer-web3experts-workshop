// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

// 📖 WORKSHOP: Interface do Verificador ZK
// O contrato que implementa essa interface e gerado automaticamente
// pelo Noir/Barretenberg (Verifier.sol).
// Ele verifica se uma prova de conhecimento zero e valida.

interface IVerifier {
    function verify(
        bytes calldata proof,
        bytes32[] calldata publicInputs
    ) external view returns (bool);
}
