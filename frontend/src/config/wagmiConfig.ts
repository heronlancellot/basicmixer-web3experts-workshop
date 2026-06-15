// ============================================================
// 📖 WORKSHOP: Configuracao wagmi + RainbowKit
// ============================================================
// Aqui configuramos QUAL blockchain a aplicacao vai usar
// e COMO conectar wallets.
//
// 🔑 CONCEITO: wagmi
// wagmi e uma biblioteca React para interagir com blockchains EVM.
// Ela abstrai a complexidade de providers, signers, e contract calls.
//
// 🔑 CONCEITO: RainbowKit
// RainbowKit fornece uma UI pronta (modal bonito) para conectar
// wallets. getDefaultConfig() combina a config do wagmi com RainbowKit.
//
// 🔑 CONCEITO: WalletConnect Project ID
// Necessario para conexoes via WalletConnect (QR code).
// Crie um em: https://cloud.walletconnect.com
// ============================================================

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { zeroAddress } from "viem";
import { sepolia } from 'wagmi/chains';

// ⚙️ COMO FUNCIONA: Variavel de ambiente
// VITE_PROJECT_ID e configurado no .env
// Necessario para WalletConnect funcionar
const projectId = import.meta.env.VITE_PROJECT_ID || '';

export const config = getDefaultConfig({
    appName: 'BasicMixer',
    // 💡 DICA: zeroAddress como fallback permite rodar em dev sem project ID
    projectId: projectId || zeroAddress, // Fallback for development
    // ⚠️ IMPORTANTE: Definimos APENAS Sepolia Testnet
    // Em producao, voce adicionaria a mainnet aqui tambem
    chains: [sepolia],
});
