// ============================================================
// 📖 WORKSHOP: Hook de Saque / Withdraw (State Machine)
// ============================================================
// Este hook gerencia o fluxo COMPLETO de um saque anonimo.
// E o processo mais complexo da aplicacao, envolvendo:
//   1. Buscar dados do indexer (todos os commitments)
//   2. Reconstruir a Merkle Tree e calcular o path
//   3. Gerar prova ZK no browser (~10-30 segundos)
//   4. Submeter a prova ao contrato
//
// 🔑 CONCEITO: Por que o withdraw e mais complexo que o deposit?
// No deposit, basta enviar um hash. No withdraw, o usuario precisa
// PROVAR que conhece um secret valido sem revela-lo. Isso requer:
//   - Todos os commitments historicos (para reconstruir a arvore)
//   - Computacao criptografica pesada (geracao da prova ZK)
//   - Verificacao on-chain da prova
//
// Fluxo:
//   IDLE → FETCHING_DATA → GENERATING_INPUTS → GENERATING_PROOF →
//   SIMULATING → AWAITING_SIGNATURE → SENDING_TRANSACTION →
//   CONFIRMING_TRANSACTION → SUCCESS (ou ERROR)
// ============================================================

import { useState, useCallback } from 'react';
import { useBasicMixer } from './useBasicMixer';
import { useIndexerHybrid } from './useIndexerHybrid';
import { publicClient } from '@/config';
import { compute } from '@/scripts/compute.mjs';
import { generateProof } from '@/helpers/generateProof';

export const WithdrawStep = {
    IDLE: 'IDLE',
    FETCHING_DATA: 'FETCHING_DATA',               // Buscando commitments do indexer
    GENERATING_INPUTS: 'GENERATING_INPUTS',         // Calculando Merkle path
    GENERATING_PROOF: 'GENERATING_PROOF',           // Gerando prova ZK (parte pesada)
    SIMULATING: 'SIMULATING',                       // Simulando tx
    AWAITING_SIGNATURE: 'AWAITING_SIGNATURE',       // Esperando assinatura
    SENDING_TRANSACTION: 'SENDING_TRANSACTION',     // Tx no mempool
    CONFIRMING_TRANSACTION: 'CONFIRMING_TRANSACTION', // Esperando confirmacao
    SUCCESS: 'SUCCESS',
    ERROR: 'ERROR',
} as const;

export type WithdrawStep = typeof WithdrawStep[keyof typeof WithdrawStep];

const LOADING_STEPS: WithdrawStep[] = [
    WithdrawStep.FETCHING_DATA,
    WithdrawStep.GENERATING_INPUTS,
    WithdrawStep.GENERATING_PROOF,
    WithdrawStep.SIMULATING,
    WithdrawStep.AWAITING_SIGNATURE,
    WithdrawStep.SENDING_TRANSACTION,
    WithdrawStep.CONFIRMING_TRANSACTION,
];

export function useWithdrawTransaction() {
    const [step, setStep] = useState<WithdrawStep>(WithdrawStep.IDLE);
    const [txHash, setTxHash] = useState<string | undefined>();
    const [error, setError] = useState<Error | undefined>();

    const { withdrawAction, address, nextIndex } = useBasicMixer();
    const { fetchCommitments } = useIndexerHybrid();

    // ⚙️ COMO FUNCIONA: executeWithdraw
    // Parametros:
    //   - encodedInput: nota base64 que o usuario salvou no deposit
    //   - leafIndex: posicao do commitment na arvore
    //   - recipientAddress: endereco que vai receber o ETH (pode ser diferente)
    const executeWithdraw = useCallback(async (
        encodedInput: string,
        leafIndex: number,
        recipientAddress?: string
    ) => {
        try {
            setStep(WithdrawStep.IDLE);
            setError(undefined);
            setTxHash(undefined);

            if (!address) throw new Error("Wallet not connected");

            // ============================================================
            // PASSO 1: Buscar todos os commitments
            // ============================================================
            // 🔑 CONCEITO: Para reconstruir a Merkle Tree, precisamos de
            // TODOS os commitments que foram depositados. O indexer
            // (ou JSON fallback) fornece essa lista.
            setStep(WithdrawStep.FETCHING_DATA);

            const totalDepositsNeeded = nextIndex ? Number(nextIndex) : leafIndex + 1;
            console.log(`[Withdraw] Contract nextIndex: ${nextIndex}, fetching ${totalDepositsNeeded} deposits`);

            const deposits = await fetchCommitments(totalDepositsNeeded);

            if (!deposits || deposits.length === 0) {
                throw new Error('No commitments found. Please try again.');
            }

            // ============================================================
            // PASSO 2: Gerar inputs para o circuito ZK
            // ============================================================
            // compute() reconstroi a Merkle Tree e calcula:
            //   - merkle_path: os 20 irmaos no caminho da folha ate a raiz
            //   - merkle_indices: direcao em cada nivel
            //   - root: raiz da arvore
            //   - nullifier_hash: Poseidon(nullifier, 0)
            setStep(WithdrawStep.GENERATING_INPUTS);

            // Valida que os commitments estao em ordem
            for (let i = 0; i < deposits.length; i++) {
                if (deposits[i].leafIndex !== i) {
                    throw new Error(`Commitments out of order! Expected ${i}, got ${deposits[i].leafIndex}`);
                }
            }

            const commitments = deposits.map((d) => d.commitment);

            // @ts-ignore
            const inputs = await compute(commitments, encodedInput);

            // ============================================================
            // PASSO 3: Gerar prova ZK no browser
            // ============================================================
            // ⚠️ IMPORTANTE: Esta e a parte mais PESADA (~10-30s).
            // O Barretenberg (WASM) executa o circuito Noir e gera
            // uma prova criptografica UltraHonk.
            setStep(WithdrawStep.GENERATING_PROOF);

            // @ts-ignore
            const proof = await generateProof(inputs);

            // ============================================================
            // PASSO 4: Assinar e enviar transacao
            // ============================================================
            setStep(WithdrawStep.AWAITING_SIGNATURE);

            // 💡 DICA: O recipient pode ser diferente do address conectado.
            // Isso e importante para privacidade: o usuario pode sacar
            // para um endereco "limpo" que ninguem associa a ele.
            const finalRecipient = (recipientAddress || address) as `0x${string}`;

            // @ts-ignore
            const hash = await withdrawAction(
                proof.proof as `0x${string}`,
                // @ts-ignore
                inputs.root_bytes32 as `0x${string}`,
                // @ts-ignore
                inputs.nullifier_hash_bytes32 as `0x${string}`,
                finalRecipient
            );

            setTxHash(hash);
            setStep(WithdrawStep.SENDING_TRANSACTION);

            // ============================================================
            // PASSO 5: Confirmar transacao on-chain
            // ============================================================
            setStep(WithdrawStep.CONFIRMING_TRANSACTION);

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (receipt.status === 'success') {
                setStep(WithdrawStep.SUCCESS);
            } else {
                throw new Error('Transaction reverted');
            }

        } catch (err) {
            console.error(err);
            setStep(WithdrawStep.ERROR);
            setError(err as Error);
            throw err;
        }
    }, [withdrawAction, address, fetchCommitments]);

    const reset = useCallback(() => {
        setStep(WithdrawStep.IDLE);
        setError(undefined);
        setTxHash(undefined);
    }, []);

    return {
        step,
        txHash,
        error,
        executeWithdraw,
        reset,

        // Helpers booleanos para a UI
        isIdle: step === WithdrawStep.IDLE,
        isFetchingData: step === WithdrawStep.FETCHING_DATA,
        isGeneratingInputs: step === WithdrawStep.GENERATING_INPUTS,
        isGeneratingProof: step === WithdrawStep.GENERATING_PROOF,
        isAwaitingSignature: step === WithdrawStep.AWAITING_SIGNATURE,
        isSending: step === WithdrawStep.SENDING_TRANSACTION,
        isConfirming: step === WithdrawStep.CONFIRMING_TRANSACTION,
        isSuccess: step === WithdrawStep.SUCCESS,
        isError: step === WithdrawStep.ERROR,

        isLoading: LOADING_STEPS.includes(step),
    };
}
