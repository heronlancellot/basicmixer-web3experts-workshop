// ============================================================
// 📖 WORKSHOP: Botao de Conexao de Wallet (RainbowKit)
// ============================================================
// Este componente customiza o botao de conexao do RainbowKit.
//
// 🔑 CONCEITO: ConnectButton.Custom (Render Props)
// O RainbowKit fornece um ConnectButton.Custom que usa o padrao
// "render props": ele passa o estado da wallet (conectada?,
// qual chain?, qual endereco?) como parametros para uma funcao,
// e nos renderizamos a UI que quisermos.
//
// ⚙️ COMO FUNCIONA:
// - Nao conectado → mostra botao "Connect Wallet"
// - Chain errada → mostra botao "Wrong network"
// - Conectado → mostra endereco abreviado (ex: "0x1234...5678")
// ============================================================

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from '@/components/ui';
import { cn } from '@/utils';

export const CustomConnectButton = ({ label = "Connect Wallet", className }: { label?: string, className?: string }) => {
    return (
        <ConnectButton.Custom>
            {({
                account,         // Dados da conta (endereco, saldo, nome)
                chain,           // Chain atual (Sepolia)
                openAccountModal,  // Abre modal com detalhes da conta
                openChainModal,    // Abre modal para trocar de chain
                openConnectModal,  // Abre modal para conectar wallet
                authenticationStatus,
                mounted,         // true quando o componente esta pronto
            }) => {
                const ready = mounted && authenticationStatus !== 'loading';
                const connected =
                    ready &&
                    account &&
                    chain &&
                    (!authenticationStatus ||
                        authenticationStatus === 'authenticated');
                return (
                    <div
                        {...(!ready && {
                            'aria-hidden': true,
                            'style': {
                                opacity: 0,
                                pointerEvents: 'none',
                                userSelect: 'none',
                            },
                        })}
                    >
                        {(() => {
                            // Estado 1: Nao conectado → mostra botao de conexao
                            if (!connected) {
                                return (
                                    <Button onClick={openConnectModal} type="button" className={cn('p-2', className)} variant='secondary' >
                                        {label}
                                    </Button>
                                );
                            }
                            // Estado 2: Chain errada → mostra aviso
                            if (chain.unsupported) {
                                return (
                                    <button onClick={openChainModal} type="button">
                                        Wrong network
                                    </button>
                                );
                            }
                            // Estado 3: Conectado → mostra endereco
                            return (
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <Button onClick={openAccountModal} type="button" variant='secondary' className={className}>
                                        {account.displayName}
                                    </Button>
                                </div>
                            );
                        })()}
                    </div>
                );
            }}
        </ConnectButton.Custom>
    );
};
