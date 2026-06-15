// ============================================================
// 📖 WORKSHOP: API do Indexer
// ============================================================
// Este arquivo configura os endpoints HTTP do indexer.
// O Ponder expoe os dados indexados via GraphQL e SQL.
//
// 🔑 CONCEITO: Hono
// Hono e um framework web leve para criar APIs HTTP.
// O Ponder usa Hono internamente para servir os endpoints.
//
// ⚙️ COMO FUNCIONA:
// - GET /graphql → Interface GraphQL para consultar depositos e saques
// - GET /sql/*   → Interface SQL direta para queries avancadas
//
// 💡 DICA: Para testar, acesse http://localhost:42069/graphql
// no browser e faca uma query como:
//
//   {
//     depositEvents(orderBy: "leafIndex", orderDirection: "asc") {
//       items {
//         commitment
//         leafIndex
//         blockNumber
//       }
//     }
//   }
//
// O frontend usa exatamente esse endpoint para buscar todos os
// commitments necessarios para reconstruir a Merkle Tree.
// ============================================================

import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { client, graphql } from "ponder";

const app = new Hono();

// Endpoint SQL - permite queries SQL diretas nos dados indexados
app.use("/sql/*", client({ db, schema }));

// Endpoints GraphQL - interface principal para o frontend
app.use("/", graphql({ db, schema }));
app.use("/graphql", graphql({ db, schema }));

export default app;
