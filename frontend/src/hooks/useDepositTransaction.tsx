// ============================================================
// 📖 WORKSHOP: Hook de Deposito (State Machine)
// ============================================================
// Este hook gerencia o fluxo COMPLETO de um deposito,
// desde a geracao do commitment ate a confirmacao on-chain.
//
// 🔑 CONCEITO: State Machine (Maquina de Estados)
// O deposito e um processo com varios passos sequenciais.
// Usamos um "step" (estado atual) para controlar em qual
// fase estamos e renderizar a UI correspondente.
//
// Fluxo:
//   IDLE → GENERATING_COMMITMENT → SIMULATING →
//   AWAITING_SIGNATURE → SENDING_TRANSACTION →
//   CONFIRMING_TRANSACTION → SUCCESS (ou ERROR)
//
// Cada estado mapeia para uma mensagem diferente no botao.
// ============================================================

import { useState, useCallback } from 'react';
import { useBasicMixer } from './useBasicMixer';
import { publicClient } from '@/config';

// ⚙️ COMO FUNCIONA: Definicao dos Estados
// Enum-like pattern com "as const" para type safety.
export const DepositStep = {
    IDLE: 'IDLE',                                 // Pronto para depositar
    GENERATING_COMMITMENT: 'GENERATING_COMMITMENT', // Gerando secret + nullifier + hash
    SIMULATING: 'SIMULATING',                       // Simulando tx localmente
    AWAITING_SIGNATURE: 'AWAITING_SIGNATURE',       // Esperando usuario assinar no MetaMask
    SENDING_TRANSACTION: 'SENDING_TRANSACTION',     // Tx enviada, no mempool
    CONFIRMING_TRANSACTION: 'CONFIRMING_TRANSACTION', // Esperando mineracao
    SUCCESS: 'SUCCESS',                             // Deposito confirmado!
    ERROR: 'ERROR',                                 // Algo deu errado
} as const;

export type DepositStep =
    typeof DepositStep[keyof typeof DepositStep];

// Estados que mostram loading no botao
const LOADING_STEPS: DepositStep[] = [
    DepositStep.GENERATING_COMMITMENT,
    DepositStep.SIMULATING,
    DepositStep.AWAITING_SIGNATURE,
    DepositStep.SENDING_TRANSACTION,
    DepositStep.CONFIRMING_TRANSACTION,
];

export function useDepositTransaction() {
    const [step, setStep] = useState<DepositStep>(DepositStep.IDLE);
    const [txHash, setTxHash] = useState<string | undefined>();
    const [error, setError] = useState<Error | undefined>();

    const { depositAction, refetchNextIndex } = useBasicMixer();

    // ⚙️ COMO FUNCIONA: executeDeposit
    // Recebe uma funcao generateZKProof que:
    //   1. Gera secret e nullifier aleatorios
    //   2. Calcula commitment = Poseidon(secret, nullifier)
    //   3. Salva os dados no commitmentStore
    //   4. Retorna o commitment como bytes32
    //
    // Depois chama depositAction(commitment) que interage com o contrato.
    const executeDeposit = useCallback(async (generateZKProof: () => Promise<string>) => {
        try {
            setStep(DepositStep.IDLE);
            setError(undefined);
            setTxHash(undefined);

            // PASSO 1: Gerar commitment (off-chain, no browser)
            setStep(DepositStep.GENERATING_COMMITMENT);

            await new Promise(resolve => setTimeout(resolve, 2500));
            const commitment = await generateZKProof();

            // PASSO 2: Simular transacao
            setStep(DepositStep.SIMULATING);

            // PASSO 3: Assinar e enviar (abre MetaMask)
            setStep(DepositStep.AWAITING_SIGNATURE);
            const hash = await depositAction(commitment as `0x${string}`);

            setTxHash(hash);

            // PASSO 4: Tx no mempool, aguardando mineracao
            setStep(DepositStep.SENDING_TRANSACTION);
            await new Promise(resolve => setTimeout(resolve, 2500));

            // PASSO 5: Esperando confirmacao on-chain
            setStep(DepositStep.CONFIRMING_TRANSACTION);

            // 💡 DICA: waitForTransactionReceipt espera a tx ser minerada
            // Retorna o receipt com status "success" ou "reverted"
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            await new Promise(resolve => setTimeout(resolve, 2500));

            if (receipt.status === 'success') {
                setStep(DepositStep.SUCCESS);
                // Atualiza o nextIndex para refletir o novo deposito
                refetchNextIndex();
            } else {
                throw new Error('Transaction reverted');
            }

        } catch (err) {
            console.error(err);
            setStep(DepositStep.ERROR);
            setError(err as Error);

            throw err;
        }
    }, [depositAction, refetchNextIndex]);

    const reset = useCallback(() => {
        setStep(DepositStep.IDLE);
        setError(undefined);
        setTxHash(undefined);
    }, []);

    return {
        step,
        txHash,
        error,
        executeDeposit,
        reset,

        // Helpers booleanos para a UI
        isIdle: step === DepositStep.IDLE,
        isGenerating: step === DepositStep.GENERATING_COMMITMENT,
        isSimulating: step === DepositStep.SIMULATING,
        isAwaitingSignature: step === DepositStep.AWAITING_SIGNATURE,
        isSending: step === DepositStep.SENDING_TRANSACTION,
        isConfirming: step === DepositStep.CONFIRMING_TRANSACTION,
        isSuccess: step === DepositStep.SUCCESS,
        isError: step === DepositStep.ERROR,

        isLoading: LOADING_STEPS.includes(step),
    };
}
