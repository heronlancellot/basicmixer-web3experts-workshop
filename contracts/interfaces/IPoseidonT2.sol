// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

// 📖 WORKSHOP: Interface do Hash Poseidon
// O contrato Poseidon e deployado via bytecode (ByteCodeDeployer).
// Aridade 2 = recebe 2 inputs e retorna 1 hash.
// Usado para construir a Merkle Tree (hash de pares de nos).

interface IPoseidonT2 {
    function poseidon(uint256[2] calldata input) external pure returns (uint256);
}
