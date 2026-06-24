// ============================================================
// 📖 WORKSHOP: Geracao de Prova ZK no Browser
// ============================================================
// Este arquivo implementa o pipeline completo de geracao de
// provas de conhecimento zero (ZK proofs) diretamente no browser.
//
// 🔑 CONCEITO: Prova ZK Client-Side
// A prova e gerada NO COMPUTADOR DO USUARIO, nao em um servidor.
// Isso e essencial para privacidade: o secret e nullifier
// NUNCA saem da maquina do usuario.
//
// ⚙️ COMO FUNCIONA - Pipeline de 7 passos:
// 1. Inicializar modulos WASM (Noir + ACVM)
// 2. Carregar o circuito compilado (basicmixer.json)
// 3. Inicializar Barretenberg (motor de provas)
// 4. Gerar witness (execucao do circuito com inputs)
// 5. Gerar prova criptografica (UltraHonk)
// 6. Verificar prova localmente (sanity check)
// 7. Formatar para o contrato Solidity
//
// 💡 DICA: Este processo leva ~10-30 segundos no browser.
// A maior parte do tempo e gasta no passo 5 (geracao da prova).
// ============================================================

import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";
import type { CompiledCircuit } from "@noir-lang/noir_js";
import initNoirC from "@noir-lang/noirc_abi";
import initACVM from "@noir-lang/acvm_js";
// 💡 DICA: Importamos os modulos WASM como URLs (Vite resolve isso)
import acvm from "@noir-lang/acvm_js/web/acvm_js_bg.wasm?url";
import noirc from "@noir-lang/noirc_abi/web/noirc_abi_wasm_bg.wasm?url";
// ⚠️ IMPORTANTE: Importa o circuito compilado pelo Nargo
// Este arquivo e gerado com: nargo compile (no diretorio circuits/basicmixer)
import circuitData from "../../../circuits/basicmixer/target/basicmixer.json";
import { toHex } from "viem";

interface ProofInputs {
    secret: string;
    nullifier: string;
    nullifier_hash: string;
    merkle_path: string[];
    merkle_indices: number[];
    root: string;
    root_bytes32: string;
    nullifier_hash_bytes32: string;
    leafIndex: number;
}

interface GeneratedProof {
    proof: `0x${string}`;
    publicInputs: string[];
}

let wasmInitialized = false;

/**
 * Inicializa modulos WASM (Noir e ACVM)
 * So precisa ser chamado uma vez
 */
// 🔑 CONCEITO: WASM (WebAssembly)
// Noir e ACVM sao escritos em Rust e compilados para WASM.
// WASM permite rodar codigo de alta performance no browser.
// A inicializacao carrega esses modulos na memoria.
export async function initializeWasm() {
    if (wasmInitialized) {
        console.log("✓ WASM ja inicializado");
        return;
    }

    console.log("Inicializando modulos WASM...");
    await Promise.all([
        initACVM(fetch(acvm)),
        initNoirC(fetch(noirc))
    ]).then((e) => console.log("e", e)).catch((e) => { console.log("error ", e) });
    wasmInitialized = true;
    console.log("✓ WASM inicializado com sucesso");
}

/**
 * Gera uma proof ZK a partir dos inputs do compute
 * @param proofInputs - Dados retornados pelo compute
 * @returns Proof formatada para enviar ao contrato
 */
export async function generateProof(proofInputs: ProofInputs): Promise<GeneratedProof> {
    console.log("\n===== Gerando Proof ZK =====");

    // PASSO 1: Garantir que WASM esta inicializado
    await initializeWasm();

    // PASSO 2: Preparar inputs para o circuito
    // ⚙️ COMO FUNCIONA: Esses inputs mapeiam para os parametros do main.nr
    // secret, nullifier → inputs PRIVADOS (nao revelados)
    // root, nullifier_hash → inputs PUBLICOS (verificados no contrato)
    // merkle_path, merkle_indices → caminho na arvore (privado)
    const input = {
        secret: proofInputs.secret,
        nullifier: proofInputs.nullifier,
        nullifier_hash: proofInputs.nullifier_hash,
        root: proofInputs.root,
        merkle_path: proofInputs.merkle_path,
        merkle_indices: proofInputs.merkle_indices
    };

    console.log("Input preparado para o circuito:");
    console.log(`- secret: ${input.secret}`);
    console.log(`- nullifier: ${input.nullifier}`);
    console.log(`- root: ${input.root}`);
    console.log(`- merkle_path length: ${input.merkle_path.length}`);
    console.log(`- merkle_indices length: ${input.merkle_indices.length}`);

    // PASSO 3: Inicializar Noir (executor do circuito)
    console.log("\nInicializando Noir...");
    const circuit = circuitData as CompiledCircuit;
    const noir = new Noir(circuit);

    // PASSO 4: Inicializar Barretenberg (motor criptografico)
    // 🔑 CONCEITO: Barretenberg
    // E o "backend" que faz a matematica pesada da prova.
    // Desenvolvido pela Aztec, implementa o sistema UltraHonk.
    console.log("Inicializando Barretenberg...");
    const api = await Barretenberg.new({ threads: navigator.hardwareConcurrency || 1 });

    // PASSO 5: Inicializar backend UltraHonk
    console.log("Inicializando backend UltraHonk...");
    const backend = new UltraHonkBackend(circuit.bytecode, api);

    // PASSO 6: Gerar witness
    // 🔑 CONCEITO: Witness
    // O "witness" e a execucao do circuito com os inputs fornecidos.
    // Noir executa o circuito e gera todos os valores intermediarios.
    // Se algum assert falhar aqui, a prova e impossivel (inputs invalidos).
    console.log("\nGerando witness...");
    const { witness } = await noir.execute(input);
    console.log("✓ Witness gerado");

    // PASSO 7: Gerar prova criptografica
    // Esta e a parte mais pesada (~10-30s).
    // keccakZK: true → usa keccak para compatibilidade com Solidity
    console.log("\nGerando proof ZK...");
    const proof = await backend.generateProof(witness, { verifierTarget: 'evm' });

    // PASSO 8: Verificar prova localmente (sanity check)
    // Verificamos antes de enviar ao contrato para evitar gastar gas
    // em uma prova invalida.
    console.log("\nVerificando proof localmente...");
    const isValid = await backend.verifyProof(proof, { verifierTarget: 'evm' });
    console.log(`✓ Proof e ${isValid ? "VALIDA" : "INVALIDA"}`);

    if (!isValid) {
        throw new Error("❌ Proof gerada e invalida!");
    }

    // PASSO 9: Formatar proof para o contrato
    // ⚙️ COMO FUNCIONA: A prova e convertida para hex string
    // O contrato Solidity recebe bytes, entao usamos toHex()
    const formattedProof = {
        proof: toHex(proof.proof),
        publicInputs: proof.publicInputs
    };

    console.log("\n===== Proof ZK Gerada com Sucesso =====");
    console.log(`Proof size: ${formattedProof.proof.length} bytes`);
    console.log(`Public inputs: ${formattedProof.publicInputs.length}`);
    console.log("=========================================\n");

    return formattedProof;
}

// ================================
// Format deposit info to exact output format
// ================================
export function formatDepositInfo(depositInfo: {
    secret: string;
    nullifier: string;
    commitment: string;
    nullifier_hash: string;
    nullifier_hash_bytes32: string;
    leafIndex: string;
    currentRoot: string | undefined;
    "root (computed)": string;
    "root (bytes32)": string;
    merkle_path: string[];
    merkle_indices: bigint[];
}): string {
    let output = '';

    output += `secret= "${depositInfo.secret}"\n`;
    output += `nullifier= "${depositInfo.nullifier}"\n`;
    output += `commitment= "${depositInfo.commitment}"\n`;
    output += `nullifier_hash= "${depositInfo.nullifier_hash}"\n`;
    output += `nullifier_hash_bytes32= "${depositInfo.nullifier_hash_bytes32}"\n`;
    output += `leafIndex= "${depositInfo.leafIndex}"\n`;
    output += `currentRoot= "${depositInfo.currentRoot || ''}"\n`;
    output += `root= "${depositInfo["root (computed)"]}"\n`;
    output += `rootbytes32= "${depositInfo["root (bytes32)"]}"\n`;

    output += `merkle_path= [\n`;
    depositInfo.merkle_path.forEach(v => {
        output += `  "${v}",\n`;
    });
    output += `]\n`;

    output += `merkle_indices= [\n`;
    depositInfo.merkle_indices.forEach(i => {
        output += `  "${i.toString()}",\n`;
    });
    output += `]`;

    return output;
}
