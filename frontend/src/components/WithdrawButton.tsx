// ============================================================
// 📖 WORKSHOP: Componente de Saque (Withdraw)
// ============================================================
// Este componente gerencia a UI do fluxo de withdraw:
//   1. Campo para colar a nota encriptada (base64)
//   2. Campo para endereco do destinatario
//   3. Botao que executa todo o fluxo de saque
//
// 🔑 CONCEITO: Fluxo do Withdraw na UI
// - Usuario cola a nota base64 → auto-decode apos 3 segundos
// - Opcionalmente define endereco destinatario (para privacidade)
// - Clica "Withdraw 0.01 ETH" → executa todo o pipeline:
//   fetch commitments → compute Merkle → gera prova ZK → envia tx
// - Modal de sucesso mostra o hash da transacao
// ============================================================

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import axios from 'axios'
import { useCommitmentStore } from '@/stores/commitmentStore'
import { useWithdrawTransaction, WithdrawStep } from '@/hooks/useWithdrawTransaction'
import { useAccount } from 'wagmi'
import { Button } from '@/components/ui'
import { isAddress, type Address } from 'viem'
import { Label, WithdrawSuccessModal } from '@/components'
import { parseViemError } from '@/helpers/parseViemError'

// Mapeia cada estado do withdraw para uma mensagem no botao
function textWithdrawLabels({ step }: { step: WithdrawStep }) {
  switch (step) {
    case WithdrawStep.FETCHING_DATA:
      return "Searching Merkle Tree data..."
    case WithdrawStep.GENERATING_INPUTS:
      return "Calculating Merkle tree path..."
    case WithdrawStep.GENERATING_PROOF:
      return "Generating ZK Proof (can take a while)..."
    case WithdrawStep.AWAITING_SIGNATURE:
      return "Awaiting Signature..."
    case WithdrawStep.SENDING_TRANSACTION:
      return "Sending Transaction onchain..."
    case WithdrawStep.CONFIRMING_TRANSACTION:
      return "Confirming Transaction..."
    case WithdrawStep.SUCCESS:
      return "Withdrawal successful!"
    case WithdrawStep.ERROR:
      return "Withdrawal error!"
    default:
      return "Withdraw 0.01 ETH"
  }
}

export const WithdrawButton = () => {
  const { commitmentData, decodeData } = useCommitmentStore()

  const {
    step,
    txHash,
    executeWithdraw,
    isLoading,
    isSuccess,
    isError,
    reset,
  } = useWithdrawTransaction();

  const { address } = useAccount()
  const [encodedInput, setEncodedInput] = useState('')
  const [recipientAddress, setRecipientAddress] = useState<Address | string>('')
  const [showModal, setShowModal] = useState(false)

  // ⚙️ COMO FUNCIONA: Auto-decode da nota
  // Quando o usuario cola a nota, esperamos 3 segundos e tentamos decodificar.
  // Se invalida, mostra toast de erro.
  useEffect(() => {
    if (!encodedInput.trim()) return
    const timer = setTimeout(() => {
      try { decodeData(encodedInput) }
      catch (err) { toast.error('Invalid encoded note format') }
    }, 3000)
    return () => clearTimeout(timer)
  }, [encodedInput])

  // Valida endereco do destinatario
  useEffect(() => {
    if (!recipientAddress) return
    const timer = setTimeout(() => {
      if (!isAddress(recipientAddress)) toast.error('Not a valid address')
    }, 3000)
    return () => clearTimeout(timer)
  }, [recipientAddress])

  const handleWithdraw = async () => {
    if (!commitmentData || !encodedInput) {
      toast.error('Please paste your encoded note first!')
      return
    }

    if (recipientAddress && !isAddress(recipientAddress)) {
      toast.error('Invalid recipient address');
      return;
    }

    try {
      await executeWithdraw(
        encodedInput,
        commitmentData.leafIndex,
        recipientAddress
      );
    } catch (err) {
      // Trata erros do indexer (axios)
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 404) {
          toast.error('Indexer is offline. Please try again later.');
          setTimeout(() => { reset(); }, 3000);
          return;
        }
        if (status) {
          toast.error(`Indexer error: HTTP ${status}`);
          setTimeout(() => { reset(); }, 3000);
          return;
        }
        toast.error('Network error. Unable to reach indexer.');
        setTimeout(() => { reset(); }, 3000);
        return;
      }

      // Trata erros do contrato
      const parsed = parseViemError(err);

      if (parsed.type === 'user_rejected') {
        toast.error('User rejected the transaction.');
      } else if (parsed.errorName === "NullifierAlreadyUsed") {
        // ⚠️ IMPORTANTE: Este erro significa que a nota ja foi usada
        // para um saque. Cada nota so pode ser usada UMA vez.
        toast.error("Nullifer already used.")
      } else if (parsed.type === 'revert') {
        if (parsed.reason === 'recipient sanctioned') {
          toast.error('Can not withdraw to a Blacklisted address.');
        } else {
          toast.error(`Transaction reverted: ${parsed.reason}`);
        }
      } else {
        toast.error('Withdrawal failed. Check console.');
      }

      setTimeout(() => {
        reset();
      }, 3000);
    }
  }

  // Abre modal de sucesso
  if (isSuccess && !showModal && txHash) {
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    reset()
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-5 flex-1">
      <div className="flex flex-col gap-2.5">
        {/* Campo para colar a nota encriptada */}
        <label className="text-[11px] sm:text-[12px] font-semibold uppercase tracking-wider text-[#888888]">
          Encoded Note
        </label>
        <textarea
          value={encodedInput}
          onChange={(e) => setEncodedInput(e.target.value)}
          placeholder="Paste the code you saved after making your deposit..."
          className="input min-h-[90px] sm:min-h-[100px] font-mono text-[11px] sm:text-xs resize-y"
        />

        {/* Campo para endereco do destinatario */}
        {/* 💡 DICA: Pode ser diferente da wallet conectada para privacidade */}
        <label className="text-[11px] sm:text-[12px] font-semibold uppercase tracking-wider text-[#888888]">
          Recipient Address
        </label>
        <textarea
          value={recipientAddress}
          onChange={(e) => setRecipientAddress(e.target.value)}
          placeholder="0x..."
          className="input font-mono text-[11px] sm:text-xs resize-y"
        />
      </div>

      <Button
        onClick={handleWithdraw}
        disabled={!commitmentData || isLoading || isSuccess || isError}
        variant="primary"
        isLoading={isLoading}
      >
        {!commitmentData ? (
          <Label text={"Paste encoded note first"} />
        ) : (
          <Label text={textWithdrawLabels({ step: step })} />
        )}
      </Button>

      <WithdrawSuccessModal
        recipientAddress={recipientAddress || address || ''}
        isOpen={showModal}
        onClose={handleCloseModal}
        transactionHash={txHash || ''}
      />
    </div>
  )
}
