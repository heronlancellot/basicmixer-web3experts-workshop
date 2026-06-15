// ============================================================
// 📖 WORKSHOP: Componente de Deposito
// ============================================================
// Este componente renderiza o botao de deposito e gerencia
// a interacao do usuario com o fluxo de deposit.
//
// ⚙️ COMO FUNCIONA:
// 1. Usuario clica "Deposit 0.001 ETH"
// 2. handleDeposit() e chamado:
//    a. Gera secret + nullifier aleatorios
//    b. Calcula commitment = Poseidon(secret, nullifier)
//    c. Salva dados no commitmentStore (para gerar a nota)
//    d. Chama depositAction(commitment) no contrato
// 3. O botao mostra o estado atual (loading, awaiting signature, etc.)
// 4. Ao sucesso, abre modal com a nota encriptada para copiar
//
// 🔑 CONCEITO: Separacao de responsabilidades
// - useDepositTransaction: gerencia o FLUXO (estados, transicoes)
// - useBasicMixer: gerencia a INTERACAO com o contrato
// - useCommitmentStore: gerencia os DADOS secretos
// - DepositButton: gerencia a UI
// ============================================================

import toast from 'react-hot-toast'
import { useEffect, useState } from 'react'
import { useDepositTransaction, DepositStep } from '@/hooks/useDepositTransaction'
import { getPoseidon, randField, toBytes32 } from '@/helpers/zk'
import { useCommitmentStore } from '@/stores/commitmentStore'
import { DepositSuccessModal, Label } from '@/components'
import { Button, Icon } from '@/components/ui'
import { useBasicMixer } from '@/hooks'
import { useAccount } from 'wagmi'
import { parseViemError } from '@/helpers/parseViemError'

// Mapeia cada estado do deposit para uma mensagem no botao
function textDepositLabels({ step }: { step: DepositStep }) {
  switch (step) {
    case DepositStep.GENERATING_COMMITMENT:
      return "Generating Commitment Data ..."
    case DepositStep.SIMULATING:
      return "Simulating Transaction..."
    case DepositStep.AWAITING_SIGNATURE:
      return "Awaiting Signature..."
    case DepositStep.SENDING_TRANSACTION:
      return "Sending Transaction onchain..."
    case DepositStep.CONFIRMING_TRANSACTION:
      return "Confirming Transaction..."
    case DepositStep.SUCCESS:
      return "Deposit successful!"
    case DepositStep.ERROR:
      return "Deposit error!"
    default:
      return "Deposit 0.001 ETH"
  }
}

export function DepositButton() {
  const {
    step,
    executeDeposit,
    isLoading,
    isSuccess,
    isError,
    reset,
  } = useDepositTransaction();

  const { nextIndex, refetchNextIndex } = useBasicMixer();
  const { isConnected } = useAccount();
  const [showModal, setShowModal] = useState(false);
  const { encodeData, encodedData } = useCommitmentStore();

  // Toast de sucesso quando deposito confirma
  useEffect(() => {
    if (step === "SUCCESS" || isSuccess) {
      toast.success('Deposit successful!')
      refetchNextIndex()
    }
  }, [isSuccess, refetchNextIndex])

  const handleDeposit = async () => {
    if (!isConnected) {
      toast.error('Please connect your wallet first')
      return
    }

    try {
      // ⚙️ COMO FUNCIONA: Geracao do Commitment
      // A funcao passada para executeDeposit() gera os dados secretos:
      await executeDeposit(async () => {
        const leafIndex = Number(nextIndex || 0)
        if (!nextIndex) {
          console.warn('nextIndex not available, using 0 as fallback')
        }

        // 1. Instancia Poseidon (hash ZK-friendly)
        const poseidon = await getPoseidon()

        // 2. Gera secret e nullifier ALEATORIOS
        // ⚠️ IMPORTANTE: Estes valores sao a "chave" do deposito.
        // Se o usuario perder, perde o ETH.
        const secret = randField()
        const nullifier = randField()

        // 3. Calcula commitment = Poseidon(secret, nullifier)
        const commitment = poseidon([secret, nullifier])
        const commitmentBytes32 = toBytes32(poseidon.F.toObject(commitment)) as `0x${string}`

        // 4. Salva no store para gerar a nota base64
        encodeData({
          secret,
          nullifier,
          leafIndex,
        })

        // 5. Retorna o commitment para o hook enviar ao contrato
        return commitmentBytes32;
      });
    } catch (err) {
      // Trata erros especificos do contrato
      const parsed = parseViemError(err);

      if (parsed.type === 'user_rejected') {
        toast.error('User rejected the transaction.');
      } else if (parsed.type === 'revert') {
        if (parsed.reason === 'this address is blacklisted and cannot deposit') {
          toast.error('Blacklisted address.');
        } else {
          toast.error(`Transaction reverted: ${parsed.reason}`);
        }
      } else {
        toast.error('Unknown error occurred');
      }

      setTimeout(() => {
        reset();
      }, 3000);
    }
  }

  // Abre modal de sucesso automaticamente
  if (isSuccess && !showModal && encodedData) {
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false);
    reset();
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-5 flex-1">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Icon name="shield" size={14} color="#00FFB3" className="flex-shrink-0" />
          <h4 className="text-[11px] sm:text-[12px] font-semibold text-[#00FFB3] uppercase tracking-wider">
            How it Works
          </h4>
        </div>
        <div className="flex flex-col gap-2 text-[10px] sm:text-[11px] text-[#888888] leading-relaxed">
          <p>• Deposit 0.001 ETH to break the on-chain link between addresses</p>
          <p>• Receive an encrypted note to withdraw privately later</p>
        </div>
      </div>

      <Button
        onClick={handleDeposit}
        disabled={isLoading || isSuccess || isError}
        variant="primary"
        isLoading={isLoading}
      >
        <Label text={textDepositLabels({ step: step })} />
      </Button>

      {/* Modal que aparece apos deposito com sucesso */}
      {/* ⚠️ IMPORTANTE: O usuario DEVE copiar a nota antes de fechar! */}
      <DepositSuccessModal
        isOpen={showModal}
        onClose={handleCloseModal}
        encodedData={encodedData}
      />
    </div>
  )
}
