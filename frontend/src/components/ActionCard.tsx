// ============================================================
// 📖 WORKSHOP: ActionCard - Container de Tabs (Deposit/Withdraw)
// ============================================================
// Este componente e o container principal da area de interacao.
// Ele renderiza duas tabs: "Deposit" e "Withdraw".
//
// ⚙️ COMO FUNCIONA:
// - Se wallet NAO conectada → mostra prompt "Connect Your Wallet"
// - Se wallet conectada → mostra tabs Deposit/Withdraw
// - Tab ativa renderiza DepositButton ou WithdrawButton
//
// 🔑 CONCEITO: Padrao de Tabs
// useState controla qual tab esta ativa. Cada tab renderiza
// um componente diferente, mas compartilham o mesmo container.
// ============================================================

import { useState, memo } from 'react'
import { DepositButton, WithdrawButton } from '@/components'
import { Icon, TabButton } from '@/components/ui'

interface ActionCardProps {
  isConnected: boolean
}

// Componente de prompt para conectar wallet (memoizado para performance)
const ConnectWalletPrompt = memo(function ConnectWalletPrompt() {

  return (
    <div className="card w-full p-6 sm:p-8 flex flex-col items-center gap-4 text-center">
      <div className="w-14 h-14 rounded-full flex items-center justify-center bg-[#00D395]/10">
        <Icon name="user" size={28} color="#00FFB3" />
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-[18px] sm:text-[20px] font-bold">Connect Your Wallet</h3>
        <p className="text-[13px] sm:text-[14px] text-[#888888]">
          Connect to start using BasicMixer
        </p>
      </div>
    </div>
  )
})

export function ActionCard({ isConnected }: ActionCardProps) {
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit')

  return (
    <div className="w-full max-w-full">
      {isConnected ? (
        <div className="card-flat w-full">
          {/* Tabs de navegacao */}
          <div className="flex border-b border-white/5">
            <TabButton
              label="Deposit"
              icon={<Icon name="deposit" size={14} />}
              isActive={activeTab === 'deposit'}
              onClick={() => setActiveTab('deposit')}
            />
            <TabButton
              label="Withdraw"
              icon={<Icon name="withdraw" size={14} />}
              isActive={activeTab === 'withdraw'}
              onClick={() => setActiveTab('withdraw')}
            />
          </div>

          {/* Conteudo da tab ativa */}
          <div className="p-5 sm:p-6">
            {activeTab === 'deposit' ? <DepositButton /> : <WithdrawButton />}
          </div>
        </div>
      ) : (
        <ConnectWalletPrompt />
      )}
    </div>
  )
}
