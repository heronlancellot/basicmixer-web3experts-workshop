# BasicMixer - Workshop

Workshop pratico de ~2 horas para construir e deployar um **privacy pool** completo usando **Noir ZK Proofs**, **Solidity**, e **React**.

## O que voce vai aprender

- Como funciona um privacy pool (commit/withdraw com provas de conhecimento zero)
- Compilar circuitos ZK com **Noir** e gerar verificadores Solidity
- Deployar smart contracts (Verifier + Poseidon + BasicMixer) na **Sepolia**
- Configurar um indexer com **Ponder** para escutar eventos on-chain
- Conectar um frontend **React + Vite** ao contrato via **wagmi + RainbowKit**
- Gerar provas ZK diretamente no browser com **Barretenberg**

## Estrutura do Repositorio

```
basicmixer-workshop/
├── contracts/          # Smart contract principal (Solidity)
├── circuits/           # Circuito ZK (Noir)
├── helpers/            # Contratos auxiliares (BytecodeDeployer)
├── indexer/            # Indexer de eventos (Ponder)
├── frontend/           # Frontend React + Vite
├── BACKEND.md          # Tutorial Parte 1: Circuito + Contrato + Indexer
└── FRONTEND.md         # Tutorial Parte 2: Frontend
```

## Pre-requisitos

### Ferramentas

| Ferramenta | Versao | Instalacao |
|------------|--------|------------|
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org) |
| **pnpm** | 8+ | `npm install -g pnpm` |
| **Nargo** | 1.0+ | `curl -L https://raw.githubusercontent.com/noir-lang/noirup/refs/heads/main/install | bash && noirup` |
| **Barretenberg (bb)** | - | Instalado com `bbup` (vem com noirup) |
| **MetaMask** | - | [metamask.io](https://metamask.io) |

### Configuracoes

1. **MetaMask**: Adicionar rede Sepolia Testnet
   - Network Name: `Sepolia Testnet`
   - RPC URL: `https://rpc.sepolia.org`
   - Chain ID: `11155111`
   - Symbol: `ETH`
   - Explorer: `https://sepolia.etherscan.io`

2. **ETH Testnet**: Obter ETH de teste no [faucet](https://sepoliafaucet.com)

3. **WalletConnect Project ID** (opcional): Criar em [cloud.walletconnect.com](https://cloud.walletconnect.com)

4. **Remix IDE**: Abrir [remix.ethereum.org](https://remix.ethereum.org) no browser

## Fluxo do Workshop

```
┌─────────────────────────────────────────────────────┐
│                   BACKEND (~60 min)                  │
│                                                      │
│  1. Compilar Circuito Noir  →  Gerar Verifier.sol   │
│  2. Deployar Contratos      →  Verifier + Poseidon  │
│                                 + BasicMixer         │
│  3. Compilar Indexer        →  Ponder (GraphQL)     │
│                                                      │
├─────────────────────────────────────────────────────┤
│                  FRONTEND (~60 min)                  │
│                                                      │
│  4. Setup Frontend          →  Vite + React + wagmi │
│  5. Walkthrough Codigo      →  Hooks, ZK, UI        │
│  6. Demo Deposit + Withdraw →  End-to-end           │
│                                                      │
└─────────────────────────────────────────────────────┘
```

## Como seguir o workshop

1. Clone este repositorio
2. Siga **BACKEND.md** (Parte 1)
3. Siga **FRONTEND.md** (Parte 2)

Todos os arquivos-chave possuem **comentarios didaticos** extensivos (marcados com 📖, 🔑, ⚙️, ⚠️, 💡) que explicam o que cada parte do codigo faz.

## Tech Stack

| Camada | Tecnologia |
|--------|------------|
| Smart Contract | Solidity 0.8.31, OpenZeppelin |
| ZK Circuit | Noir, Barretenberg (UltraHonk) |
| Hash Function | Poseidon (BN254) |
| Indexer | Ponder, Hono, GraphQL |
| Frontend | React 19, Vite 7, TypeScript |
| Web3 | wagmi 3, viem 2, RainbowKit 2 |
| State | Zustand |
| Styling | Tailwind CSS 4 |
| Network | Sepolia Testnet (Chain ID 11155111) |
