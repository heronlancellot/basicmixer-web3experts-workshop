// ============================================================
// 📖 WORKSHOP: Commitment Store (Zustand)
// ============================================================
// Este arquivo gerencia os dados SECRETOS do usuario:
// o secret, nullifier, e leafIndex que ele recebe apos um deposito.
//
// 🔑 CONCEITO: Por que precisamos guardar esses dados?
// Apos o deposito, o usuario precisa do secret e nullifier para
// gerar a prova ZK de saque. Se ele perder esses dados, PERDE
// o acesso ao ETH depositado - para sempre. Nao ha recuperacao.
//
// 🔑 CONCEITO: Zustand
// Zustand e uma biblioteca de state management para React.
// Mais simples que Redux, permite criar "stores" com estado
// e acoes. Qualquer componente pode acessar via useCommitmentStore().
//
// ⚙️ COMO FUNCIONA: Encoding/Decoding
// Os dados (secret, nullifier, leafIndex) sao convertidos em
// uma string base64 (a "nota encriptada" que o usuario copia).
// Essa string pode ser colada no campo de withdraw para restaurar
// os dados e gerar a prova ZK.
//
// Formato da nota: base64(JSON({secret, nullifier, leafIndex}))
// ============================================================

import { create } from 'zustand';

export interface CommitmentData {
    secret: bigint;     // Valor aleatorio gerado no deposit
    nullifier: bigint;  // Valor aleatorio para prevenir double-spend
    leafIndex: number;  // Posicao na Merkle Tree
}

/**
 * Encode CommitmentData to base64 string
 * Use this after deposit to save the secret data
 * NOTE: Commitment is NOT stored (can be recalculated from secret + nullifier)
 */
// 💡 DICA: O commitment em si NAO e armazenado na nota.
// Ele pode ser recalculado a qualquer momento:
//   commitment = Poseidon(secret, nullifier)
export function encodeCommitmentData(data: CommitmentData): string {
    const obj = {
        secret: data.secret.toString(),
        nullifier: data.nullifier.toString(),
        leafIndex: data.leafIndex.toString()
    };

    const jsonString = JSON.stringify(obj);
    // btoa() converte string para base64
    const encoded = btoa(jsonString);
    return encoded;
}

/**
 * Decode base64 string back to CommitmentData
 * Use this before withdraw to restore the secret data
 */
export function decodeCommitmentData(encoded: string): CommitmentData {
    try {
        // atob() converte base64 para string
        const jsonString = atob(encoded);
        const obj = JSON.parse(jsonString);

        return {
            secret: BigInt(obj.secret),
            nullifier: BigInt(obj.nullifier),
            leafIndex: parseInt(obj.leafIndex, 10)
        };
    } catch (error) {
        throw new Error('Invalid encoded commitment data');
    }
}

interface CommitmentStore {
    // State
    commitmentData: CommitmentData | null;
    encodedData: string;
    error: string;
    copySuccess: boolean;

    // Actions
    encodeData: (data: CommitmentData) => string;
    decodeData: (encoded: string) => CommitmentData;
    copyToClipboard: () => Promise<boolean>;
    clearAll: () => void;
}

// ⚙️ COMO FUNCIONA: Zustand Store
// create<CommitmentStore>() cria um store com estado e acoes.
// Componentes usam: const { encodedData, encodeData } = useCommitmentStore()
export const useCommitmentStore = create<CommitmentStore>((set, get) => ({
    // Estado inicial
    commitmentData: null,
    encodedData: '',
    error: '',
    copySuccess: false,

    // Encoda dados do commitment (chamado apos deposit)
    encodeData: (data: CommitmentData) => {
        try {
            const encoded = encodeCommitmentData(data);
            set({
                commitmentData: data,
                encodedData: encoded,
                error: '',
                copySuccess: false
            });
            return encoded;
        } catch (err: any) {
            const errorMsg = `Erro ao encodar dados: ${err.message}`;
            set({ error: errorMsg });
            throw new Error(errorMsg);
        }
    },

    // Decodifica dados do commitment (chamado antes do withdraw)
    decodeData: (encoded: string) => {
        try {
            const decoded = decodeCommitmentData(encoded);
            set({
                commitmentData: decoded,
                encodedData: encoded,
                error: '',
                copySuccess: false
            });
            return decoded;
        } catch (err: any) {
            const errorMsg = `Erro ao decodar dados: ${err.message}`;
            set({ error: errorMsg, commitmentData: null });
            throw new Error(errorMsg);
        }
    },

    // Copia nota para clipboard
    copyToClipboard: async () => {
        const { encodedData } = get();
        if (!encodedData) {
            set({ error: 'Nenhum dado para copiar', copySuccess: false });
            return false;
        }

        try {
            await navigator.clipboard.writeText(encodedData);
            set({ copySuccess: true, error: '' });

            setTimeout(() => {
                set({ copySuccess: false });
            }, 2000);

            return true;
        } catch (err: any) {
            set({ error: `Erro ao copiar: ${err.message}`, copySuccess: false });
            return false;
        }
    },

    // Limpa todos os dados
    clearAll: () => set({
        commitmentData: null,
        encodedData: '',
        error: '',
        copySuccess: false
    }),
}));
