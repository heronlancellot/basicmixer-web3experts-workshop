// ============================================================
// 📖 WORKSHOP: Configuracao do Ponder (Indexer)
// ============================================================
// O Ponder e um framework de indexacao para blockchains EVM.
// Ele escuta eventos emitidos pelos smart contracts e armazena
// os dados em um banco de dados local, expondo-os via GraphQL.
//
// 🔑 CONCEITO: Por que precisamos de um indexer?
// Sem um indexer, para saber todos os depositos feitos no contrato,
// precisariamos escanear TODOS os blocos da blockchain desde o deploy.
// Isso e lento e caro. O indexer faz esse trabalho uma vez e depois
// mantem os dados atualizados em tempo real.
//
// No contexto do BasicMixer, o indexer e essencial para o WITHDRAW:
// o frontend precisa de TODOS os commitments para reconstruir
// a Merkle Tree e gerar a prova ZK.
// ============================================================

import { createConfig } from "ponder";

import { BASIC_MIXER_ABI } from "./abis/PrimitiveManagerAbi";

export default createConfig({
  // ⚙️ COMO FUNCIONA: Configuracao de Chain
  // Definimos qual blockchain o indexer vai monitorar.
  chains: {
    sepolia: {
      // ID da chain Sepolia Testnet
      id: 11155111,
      // RPC endpoint - pode ser sobrescrito pela env var PONDER_RPC_URL_11155111
      rpc: process.env.PONDER_RPC_URL_11155111 || "https://rpc.sepolia.org",
      // ⚙️ Intervalo de polling: a cada 5 segundos, o Ponder verifica novos blocos
      pollingInterval: 5_000,
      // Limita requests por segundo para nao estourar rate limit do RPC (Alchemy free tier)
      maxRequestsPerSecond: 5,
    },
  },

  // ⚙️ COMO FUNCIONA: Configuracao de Contratos
  // Definimos quais contratos e eventos o indexer deve monitorar.
  contracts: {
    BasicMixer: {
      chain: "sepolia",
      // ABI do contrato - necessario para decodificar os eventos
      abi: BASIC_MIXER_ABI,
      // ⚠️ IMPORTANTE: Este e o endereco do contrato deployado.
      // Se voce deployou um novo contrato no workshop, atualize aqui!
      address: "0x1EA78439445CA15FDbE6F80d6F2B71E81b560701",
      // 💡 DICA: startBlock e o bloco onde o contrato foi deployado.
      // O indexer comeca a escanear a partir deste bloco, evitando
      // processar milhoes de blocos anteriores desnecessariamente.
      startBlock: 11132386,
      // Filtramos apenas os eventos que nos interessam
      filter: [
        {
          event: "Deposit",
          args: {}
        },
        {
          event: "Withdrawal",
          args: {}
        }
      ],
    },
  },
});
