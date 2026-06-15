// ============================================================
// 📖 WORKSHOP: WalletProvider - Provedor de Wallet
// ============================================================
// Este arquivo configura toda a infraestrutura de conexao com
// wallets (MetaMask, WalletConnect, etc.) para a aplicacao React.
//
// 🔑 CONCEITO: Provider Pattern
// Em React, "providers" sao componentes que envolvem a aplicacao
// e fornecem dados/funcionalidades para TODOS os componentes filhos.
// Aqui temos 3 providers aninhados:
//
//   WagmiProvider → infraestrutura blockchain (leitura/escrita)
//     QueryClientProvider → cache de dados (TanStack Query)
//       RainbowKitProvider → UI de conexao de wallet
//
// Qualquer componente dentro desses providers pode usar hooks
// como useAccount(), useReadContract(), etc.
// ============================================================

import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';

import '@rainbow-me/rainbowkit/styles.css';
import { config } from '@/config';

type Props = {
  children: React.ReactNode;
};

export function WalletProvider({ children }: Props) {
  // 💡 DICA: QueryClient gerencia cache de dados do React Query.
  // wagmi usa internamente React Query para cachear leituras do contrato.
  const queryClient = new QueryClient()

  return (
    // ⚙️ COMO FUNCIONA: Cadeia de Providers
    // 1. WagmiProvider: configura chains, transports, e conexao com blockchain
    // 2. QueryClientProvider: cache inteligente para leituras do contrato
    // 3. RainbowKitProvider: UI bonita para conectar wallet (modal, botoes)
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
