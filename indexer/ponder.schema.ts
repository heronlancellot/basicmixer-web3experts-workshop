// ============================================================
// 📖 WORKSHOP: Schema do Banco de Dados (Ponder)
// ============================================================
// Aqui definimos as tabelas do banco de dados do indexer.
// Cada tabela corresponde a um tipo de evento do smart contract.
//
// 🔑 CONCEITO: onchainTable
// O Ponder usa "onchainTable" para criar tabelas que sao
// automaticamente populadas pelos event handlers (src/index.ts).
// Essas tabelas ficam disponiveis via GraphQL e SQL.
// ============================================================

import { onchainTable } from "ponder";

// ⚙️ COMO FUNCIONA: Tabela de Depositos
// Cada vez que o evento Deposit e emitido pelo contrato,
// o event handler insere uma linha nesta tabela.
//
// Campos mapeiam diretamente para os dados do evento:
//   - commitment: Poseidon(secret, nullifier) - o hash do deposito
//   - leafIndex: posicao na Merkle Tree (0, 1, 2, ...)
//
// 💡 DICA: O frontend usa essa tabela para buscar todos os
// commitments e reconstruir a Merkle Tree durante o withdraw.
export const depositEvent = onchainTable("depositEvent", (t) => ({
  id: t.text().primaryKey(),           // ID unico (address-logIndex-blockNumber)
  commitment: t.hex().notNull(),       // Hash do deposito (Poseidon(secret, nullifier))
  leafIndex: t.integer().notNull(),    // Posicao na Merkle Tree
  transactionHash: t.hex().notNull(),  // Hash da transacao
  timestamp: t.bigint().notNull(),     // Timestamp do bloco
  blockNumber: t.bigint().notNull(),   // Numero do bloco
}));

// ⚙️ COMO FUNCIONA: Tabela de Saques
// Cada vez que o evento Withdrawal e emitido pelo contrato,
// o event handler insere uma linha nesta tabela.
//
// Campos:
//   - recipient: endereco que recebeu o ETH
//   - nullifierHash: hash do nullifier (marca o deposito como "sacado")
export const withdrawalEvent = onchainTable("withdrawalEvent", (t) => ({
  id: t.text().primaryKey(),           // ID unico
  recipient: t.hex().notNull(),        // Endereco que recebeu o ETH
  nullifierHash: t.hex().notNull(),    // Hash do nullifier (anti double-spend)
  transactionHash: t.hex().notNull(),  // Hash da transacao
  timestamp: t.bigint().notNull(),     // Timestamp do bloco
  blockNumber: t.bigint().notNull(),   // Numero do bloco
}));
