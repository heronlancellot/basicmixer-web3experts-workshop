// ============================================================
// 📖 WORKSHOP: Utilidades ZK (Poseidon + Merkle Tree)
// ============================================================
// Este arquivo contem funcoes utilitarias para criptografia ZK
// que rodam no BROWSER do usuario.
//
// 🔑 CONCEITO: circomlibjs
// Biblioteca JavaScript que implementa funcoes criptograficas
// usadas em circuitos ZK, incluindo o hash Poseidon.
// E a mesma implementacao usada no contrato Solidity e no
// circuito Noir - a CONSISTENCIA entre os 3 e critica.
//
// Se o hash no browser != hash no contrato, o sistema quebra.
// ============================================================

import { buildPoseidon } from "circomlibjs";

// =======================
// Constants
// =======================
// Mesma profundidade da Merkle Tree do contrato (TREE_DEPTH = 20)
export const TREE_DEPTH = 20;

// =======================
// Poseidon singleton
// =======================
// 💡 DICA: Poseidon e inicializado como singleton (uma unica instancia).
// buildPoseidon() e pesado (~1s), entao reutilizamos a mesma instancia.
let poseidonInstance = null;

export async function getPoseidon() {
  if (!poseidonInstance) {
    poseidonInstance = await buildPoseidon();
  }
  return poseidonInstance;
}

// =======================
// Helpers
// =======================

// 🔑 CONCEITO: Campo Finito (Field)
// Em criptografia ZK, todos os numeros vivem em um "campo finito"
// (conjunto finito de numeros com operacoes aritmeticas).
// randField() gera um numero aleatorio nesse campo.
//
// ⚙️ COMO FUNCIONA:
// Gera 31 bytes aleatorios (248 bits) usando a API Web Crypto.
// 31 bytes (nao 32) para garantir que o numero cabe no campo BN254.
export function randField() {
  const bytes = new Uint8Array(31);
  window.crypto.getRandomValues(bytes);

  let hex = "";
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, "0");
  }
  return BigInt("0x" + hex);
}

// Converte um BigInt para formato bytes32 (hex com 64 caracteres)
// Usado para enviar dados ao contrato Solidity
export function toBytes32(bn) {
  return "0x" + bn.toString(16).padStart(64, "0");
}

// =======================
// Zero tree
// =======================
// ⚙️ COMO FUNCIONA: Arvore de Zeros
// Constroi os mesmos valores "zero" que o contrato calcula no constructor.
// zeros[0] = Poseidon(0, 0)
// zeros[1] = Poseidon(zeros[0], zeros[0])
// zeros[2] = Poseidon(zeros[1], zeros[1])
// ... e assim por diante ate TREE_DEPTH
//
// Esses valores representam uma arvore "vazia" - posicoes
// onde nenhum deposito foi feito ainda.
export function buildZeroes(poseidon) {
  const zeroes = [];
  zeroes[0] = poseidon([0n, 0n]);

  for (let i = 1; i < TREE_DEPTH; i++) {
    zeroes[i] = poseidon([zeroes[i - 1], zeroes[i - 1]]);
  }
  return zeroes;
}

// =======================
// Merkle insertion
// =======================
// ⚙️ COMO FUNCIONA: Insercao na Merkle Tree (espelho do contrato)
// Esta funcao e o ESPELHO EXATO da funcao _insert() do contrato Solidity.
// Ela insere uma folha na arvore e retorna:
//   - root: nova raiz da arvore
//   - merklePath: os 20 "irmaos" no caminho (necessarios para a prova ZK)
//   - merkleIndices: direcao em cada nivel (0=esquerda, 1=direita)
//
// ⚠️ IMPORTANTE: A logica aqui DEVE ser identica ao contrato.
// Se houver divergencia, as provas ZK serao invalidas.
export function insertLeaf(poseidon, leaf, leafIndex, zeroes, filledSubtrees) {
  let currentHash = leaf;
  let index = leafIndex;

  const merklePath = [];
  const merkleIndices = [];

  for (let i = 0; i < TREE_DEPTH; i++) {
    const isRightNode = index % 2 === 1;
    let sibling;

    if (!isRightNode) {
      // No atual e filho ESQUERDO: irmao e o zero (ou proximo deposito)
      sibling = zeroes[i];
      filledSubtrees[i] = currentHash;
      currentHash = poseidon([currentHash, sibling]);
    } else {
      // No atual e filho DIREITO: irmao e o filledSubtree (ja inserido)
      sibling = filledSubtrees[i];
      currentHash = poseidon([sibling, currentHash]);
    }

    // Guarda o irmao e a direcao para a prova ZK
    merklePath.push(sibling);
    merkleIndices.push(index % 2);
    index = Math.floor(index / 2);
  }

  return { root: currentHash, merklePath, merkleIndices };
}
