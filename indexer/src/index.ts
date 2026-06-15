// ============================================================
// 📖 WORKSHOP: Event Handlers (Indexer)
// ============================================================
// Este arquivo define O QUE FAZER quando o indexer detecta
// um evento emitido pelo smart contract.
//
// 🔑 CONCEITO: Event Handlers
// No Ponder, registramos funcoes que sao chamadas automaticamente
// quando eventos especificos sao detectados na blockchain.
// Cada handler recebe:
//   - event: dados do evento (args, transaction, block)
//   - context: acesso ao banco de dados para inserir/atualizar dados
// ============================================================

import { ponder } from "ponder:registry";
import schema from "ponder:schema";

// ⚙️ COMO FUNCIONA: Handler de Deposito
// Quando o contrato emite Deposit(commitment, leafIndex),
// este handler e chamado automaticamente.
//
// event.args.commitment → o hash do deposito
// event.args.leafIndex → posicao na Merkle Tree
// event.transaction.hash → hash da tx
// event.block.timestamp → quando aconteceu
// event.block.number → em qual bloco
//
// 💡 DICA: O ID unico e composto por address+logIndex+blockNumber
// para garantir que cada evento tenha um identificador unico,
// mesmo que multiplos eventos ocorram no mesmo bloco.
ponder.on("BasicMixer:Deposit", async ({ event, context }) => {
  await context.db.insert(schema.depositEvent).values({
    id: `${event.log.address}-${event.log.logIndex}-${event.block.number}`,
    commitment: event.args.commitment,
    leafIndex: event.args.leafIndex,
    transactionHash: event.transaction.hash,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
  });
});

// ⚙️ COMO FUNCIONA: Handler de Saque
// Quando o contrato emite Withdrawal(recipient, nullifierHash),
// este handler armazena os dados do saque.
//
// Isso permite acompanhar quantos saques foram feitos,
// para quais enderecos, e quais nullifiers foram usados.
ponder.on("BasicMixer:Withdrawal", async ({ event, context }) => {
  await context.db.insert(schema.withdrawalEvent).values({
    id: `${event.log.address}-${event.log.logIndex}-${event.block.number}`,
    recipient: event.args.recipient,
    nullifierHash: event.args.nullifierHash,
    transactionHash: event.transaction.hash,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
  });
});
