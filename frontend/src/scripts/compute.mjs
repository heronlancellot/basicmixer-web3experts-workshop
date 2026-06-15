// ============================================================
// 📖 WORKSHOP: Computacao do Merkle Path (Inputs para ZK Proof)
// ============================================================
// Este script prepara TODOS os inputs necessarios para gerar
// a prova ZK de saque. E a ponte entre os dados do indexer
// e o circuito Noir.
//
// ⚙️ COMO FUNCIONA:
// 1. Decodifica a nota do usuario (base64 → secret, nullifier, leafIndex)
// 2. Valida que o commitment do usuario existe na arvore
// 3. Reconstroi a Merkle Tree inserindo TODOS os commitments
// 4. No ponto onde o commitment do usuario e inserido,
//    captura o merkle_path (irmaos) e merkle_indices (direcoes)
// 5. Calcula nullifier_hash = Poseidon(nullifier, 0)
// 6. Retorna tudo formatado para o generateProof.ts
//
// 🔑 CONCEITO: Por que reconstruir a arvore?
// A Merkle Tree nao e armazenada completamente on-chain (custaria
// muito gas). Apenas a raiz e os filledSubtrees sao guardados.
// Para gerar o merkle_path, precisamos reconstruir a arvore
// localmente usando todos os commitments historicos.
//
// ⚠️ IMPORTANTE: A reconstrucao da arvore aqui DEVE ser identica
// a insercao no contrato (_insert). Se houver divergencia,
// a raiz calculada sera diferente e a prova sera invalida.
// ============================================================

import { buildPoseidon } from "circomlibjs";
import { decodeCommitmentData } from "../stores/commitmentStore.ts";

// ================================
// CONFIG
// ================================
const TREE_DEPTH = 20;

// ================================
// Field helpers
// ================================
// Converte um elemento de campo Poseidon para string decimal
function fieldToString(poseidon, x) {
    return poseidon.F.toString(poseidon.F.e(x));
}

// Converte um elemento de campo para bytes32 (hex 64 chars)
function fieldToBytes32(poseidon, x) {
    const v = BigInt(poseidon.F.toObject(poseidon.F.e(x)));
    return "0x" + v.toString(16).padStart(64, "0");
}

// Converte hex string ou bigint para BigInt
function bytes32ToBigInt(x) {
    if (typeof x === "bigint") return x;
    if (typeof x === "string" && x.startsWith("0x")) return BigInt(x);
    throw new Error("invalid bytes32");
}

const bytesToBigInt = (bytes) => {
    let hex = "0x" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
    return BigInt(hex);
};

// ================================
// Build zero nodes
// ================================
// Mesma logica do contrato: zeros[i] = Poseidon(zeros[i-1], zeros[i-1])
function buildZeroes(poseidon, depth) {
    const zeroes = [];
    zeroes[0] = poseidon([0n, 0n]);
    for (let i = 1; i < depth; i++) {
        zeroes[i] = poseidon([zeroes[i - 1], zeroes[i - 1]]);
    }
    return zeroes;
}

// ================================
// Merkle tree insertion
// ================================
// ⚙️ COMO FUNCIONA: Insercao e Captura do Path
// Mesma logica do _insert() do contrato, mas TAMBEM captura:
//   - merklePath: os irmaos em cada nivel (necessarios para a prova)
//   - merkleIndices: direcao (0=esquerda, 1=direita)
function insertLeaf(poseidon, leaf, leafIndex, zeros, filledSubtrees) {
    let currentHash = leaf;
    let index = leafIndex;

    const merklePath = [];
    const merkleIndices = [];

    for (let i = 0; i < TREE_DEPTH; i++) {
        const isRightNode = index % 2 === 1;
        let sibling;

        if (!isRightNode) {
            sibling = zeros[i];
            filledSubtrees[i] = currentHash;
            currentHash = poseidon([currentHash, sibling]);
        } else {
            sibling = filledSubtrees[i];
            currentHash = poseidon([sibling, currentHash]);
        }

        merklePath.push(sibling);
        merkleIndices.push(index % 2);
        index = Math.floor(index / 2);
    }

    const root = currentHash;
    return { root, merklePath, merkleIndices };
}

// ================================
// Main - Gera proof inputs
// ================================
/**
 * Gera todos os inputs necessarios para criar uma proof ZK
 * @param {string[]} commitments - Array de commitments (hex) do indexer, ordenados por leafIndex
 * @param {string} encodedData - Nota base64 com secret, nullifier e leafIndex
 * @returns {Object} Inputs formatados para o circuito Noir
 */
export async function compute(commitments, encodedData) {
    const poseidon = await buildPoseidon();

    // ===== PASSO 1: Decodificar nota do usuario =====
    console.log("\n===== Decodificando dados do usuario =====");
    const { secret, nullifier, leafIndex } = decodeCommitmentData(encodedData);
    console.log(`✓ leafIndex: ${leafIndex}`);
    console.log(`✓ Secret e Nullifier decodificados`);

    // ===== PASSO 2: Validacoes =====
    if (!commitments || commitments.length === 0) {
        throw new Error("❌ Array de commitments esta vazio");
    }

    if (leafIndex >= commitments.length) {
        throw new Error(
            `❌ leafIndex ${leafIndex} invalido. Indexer retornou apenas ${commitments.length} commitments (indices 0-${commitments.length - 1})`
        );
    }

    console.log(`✓ Total de commitments na arvore: ${commitments.length}`);

    // ===== PASSO 3: Validar commitment do usuario =====
    // Recalcula commitment = Poseidon(secret, nullifier) e confere
    // com o que o indexer retornou para esse leafIndex.
    // Se nao bater, a nota esta errada ou os dados estao desatualizados.
    console.log("\n===== Validando commitment do usuario =====");
    const userCommitment = poseidon([secret, nullifier]);
    const userCommitmentHex = fieldToBytes32(poseidon, userCommitment);

    console.log(`Calculado: ${userCommitmentHex}`);
    console.log(`No indexer (leafIndex ${leafIndex}): ${commitments[leafIndex]}`);

    if (userCommitmentHex.toLowerCase() !== commitments[leafIndex].toLowerCase()) {
        throw new Error(
            `❌ Commitment nao encontrado no leafIndex ${leafIndex}!\n` +
            `Esperado: ${commitments[leafIndex]}\n` +
            `Calculado: ${userCommitmentHex}\n` +
            `Seu codigo encodado pode estar incorreto ou os dados do indexer estao desatualizados.`
        );
    }

    console.log("✓ Commitment validado com sucesso!");

    // ===== PASSO 4: Construir Merkle Tree =====
    // Inserimos TODOS os commitments na arvore, na ordem correta.
    // Quando chegamos no leafIndex do usuario, capturamos o path.
    console.log("\n===== Construindo arvore Merkle =====");
    const zeroes = buildZeroes(poseidon, TREE_DEPTH);
    const filledSubtrees = [...zeroes];

    let finalRoot, finalMerklePath, finalMerkleIndices;

    for (let i = 0; i <= leafIndex; i++) {
        const commitmentBigInt = bytes32ToBigInt(commitments[i]);
        const { root, merklePath, merkleIndices } = insertLeaf(
            poseidon,
            commitmentBigInt,
            i,
            zeroes,
            filledSubtrees
        );

        // Captura path e root quando chega no leafIndex do usuario
        if (i === leafIndex) {
            finalRoot = root;
            finalMerklePath = merklePath;
            finalMerkleIndices = merkleIndices;
        }
    }

    console.log(`✓ Arvore construida com ${leafIndex + 1} commitments`);
    console.log(`✓ Merkle path gerado para leafIndex ${leafIndex}`);

    // ===== PASSO 5: Calcular nullifier hash =====
    // nullifier_hash = Poseidon(nullifier, 0)
    // Esse valor e revelado publicamente no withdraw.
    const nullifier_hash = poseidon([nullifier, 0n]);

    // ===== PASSO 6: Formatar e retornar =====
    // Esses campos mapeiam diretamente para os inputs do main.nr
    const proofInputs = {
        secret: fieldToString(poseidon, secret),           // Input privado
        nullifier: fieldToString(poseidon, nullifier),     // Input privado
        nullifier_hash: fieldToString(poseidon, nullifier_hash), // Input publico
        nullifier_hash_bytes32: fieldToBytes32(poseidon, nullifier_hash), // Para o contrato
        merkle_path: finalMerklePath.map(v => fieldToString(poseidon, v)), // Input privado
        merkle_indices: finalMerkleIndices,                // Input privado
        root: fieldToString(poseidon, finalRoot),          // Input publico
        root_bytes32: fieldToBytes32(poseidon, finalRoot), // Para o contrato
        leafIndex: leafIndex
    };

    console.log("\n===== ✓ Proof Inputs Gerados =====");
    console.log(`leafIndex: ${proofInputs.leafIndex}`);
    console.log(`root: ${proofInputs.root}`);
    console.log(`nullifier_hash: ${proofInputs.nullifier_hash}`);
    console.log(`merkle_path length: ${proofInputs.merkle_path.length}`);
    console.log(`merkle_indices length: ${proofInputs.merkle_indices.length}`);
    console.log("====================================\n");

    return proofInputs;
}
