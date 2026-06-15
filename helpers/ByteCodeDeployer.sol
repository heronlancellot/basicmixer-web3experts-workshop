// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ============================================================
// 📖 WORKSHOP: BytecodeDeployer
// ============================================================
// Este contrato auxiliar permite deployar contratos a partir
// de bytecode puro (codigo de maquina da EVM).
//
// 🔑 CONCEITO: Por que precisamos disso?
// O contrato Poseidon NAO e escrito em Solidity. Ele e gerado
// programaticamente pela biblioteca `circomlibjs` em JavaScript:
//
//   const bytecode = poseidonContract.createCode(2);
//
// Esse bytecode implementa o hash Poseidon otimizado para a
// curva BN254 com aridade 2 (2 inputs). Como nao temos o
// codigo-fonte Solidity, usamos este deployer para colocar
// o bytecode diretamente na blockchain.
//
// ⚙️ COMO FUNCIONA:
// 1. No JavaScript, geramos o bytecode do Poseidon
// 2. Deployamos este BytecodeDeployer no Remix
// 3. Chamamos deploy(bytecode) com o bytecode do Poseidon
// 4. O endereco retornado e o contrato Poseidon deployado
// 5. Passamos esse endereco para o construtor do BasicMixer
// ============================================================

contract BytecodeDeployer {
    event Deployed(address addr);

    // ⚙️ COMO FUNCIONA: Assembly CREATE
    // A instrucao CREATE da EVM cria um novo contrato a partir de bytecode.
    // - add(bytecode, 0x20): pula os primeiros 32 bytes (tamanho do array)
    // - mload(bytecode): carrega o tamanho do bytecode
    // - create(0, ...): 0 = nao envia ETH ao novo contrato
    function deploy(bytes memory bytecode) external returns (address addr) {
        assembly {
            addr := create(0, add(bytecode, 0x20), mload(bytecode))
        }
        require(addr != address(0), "Deploy failed");
        emit Deployed(addr);
    }
}
