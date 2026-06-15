// ============================================================
// 📖 WORKSHOP: Hook de Interacao com o Contrato
// ============================================================
// Este hook e a PONTE entre o frontend React e o smart contract.
// Ele fornece:
//   - Leitura de dados do contrato (DENOMINATION, currentRoot, etc.)
//   - Funcoes para executar transacoes (deposit, withdraw)
//
// 🔑 CONCEITO: Custom Hook
// Em React, hooks customizados encapsulam logica reutilizavel.
// Qualquer componente pode chamar useBasicMixer() para acessar
// dados do contrato e executar acoes.
//
// 🔑 CONCEITO: wagmi hooks
// - useReadContract: le dados do contrato (view functions, sem gas)
// - useWriteContract: executa transacoes (muda estado, custa gas)
// - useAccount: acessa dados da wallet conectada
// ============================================================

import { useAccount, useReadContract } from 'wagmi';
import { type Address } from 'viem';
import { BASIC_MIXER_ADDRESS, BASIC_MIXER_ABI } from '../helpers/contract';
import { simulateContract, writeContract } from 'viem/actions';
import { publicClient } from '@/config';
import { useWalletClient } from 'wagmi';

/**
 * Hook de infraestrutura.
 * Fornece acesso aos dados do contrato e funcoes que executam a escrita.
 * Nao gerencia estados de UI (loading, success), apenas executa.
 */
export function useBasicMixer() {
  const { address, isConnected } = useAccount();
  const walletClient = useWalletClient({ account: address });

  // ⚙️ COMO FUNCIONA: Leitura do Contrato (Read)
  // useReadContract chama funcoes "view" do contrato - sem custo de gas.
  // wagmi automaticamente faz cache e refetch dos dados.

  // Valor fixo do deposito (0.001 ETH)
  const { data: denomination } = useReadContract({
    address: BASIC_MIXER_ADDRESS,
    abi: BASIC_MIXER_ABI,
    functionName: 'DENOMINATION',
  });

  // Raiz atual da Merkle Tree (muda a cada deposito)
  const { data: currentRoot } = useReadContract({
    address: BASIC_MIXER_ADDRESS,
    abi: BASIC_MIXER_ABI,
    functionName: 'currentRoot',
  });

  // Proximo indice disponivel na arvore (= total de depositos feitos)
  const { data: nextIndex, refetch: refetchNextIndex } = useReadContract({
    address: BASIC_MIXER_ADDRESS,
    abi: BASIC_MIXER_ABI,
    functionName: 'nextIndex',
  });

  // Maximo de folhas na arvore (2^20 = 1.048.576)
  const { data: maxLeaves } = useReadContract({
    address: BASIC_MIXER_ADDRESS,
    abi: BASIC_MIXER_ABI,
    functionName: 'MAX_LEAVES',
  });

  // ⚙️ COMO FUNCIONA: Escrita no Contrato (Write)
  // Para escrever no contrato, usamos simulateContract + writeContract:
  //   1. simulateContract: simula a tx localmente (verifica se vai funcionar)
  //   2. writeContract: envia a tx real para a blockchain
  // Isso evita gastar gas em transacoes que vao falhar.

  // 📖 WORKSHOP: Funcao de Deposito
  // Chama deposit(commitment) no contrato, enviando DENOMINATION
  const depositAction = async (commitment: Address) => {
    if (!denomination) throw new Error('Missing contract config');
    if (!walletClient.data) throw new Error('Wallet not connected');
    if (!address) throw new Error('Address not found');

    // 1. Simular a transacao antes de enviar
    const { request } = await simulateContract(publicClient, {
      address: BASIC_MIXER_ADDRESS,
      abi: BASIC_MIXER_ABI,
      functionName: 'deposit',
      args: [commitment],
      // ⚠️ IMPORTANTE: Envia exatamente DENOMINATION (0.001 ETH)
      value: denomination,
      account: address,
    });

    // 2. Assinar e enviar (abre MetaMask para o usuario confirmar)
    const hash = await writeContract(walletClient.data, request);

    return hash;
  };

  // 📖 WORKSHOP: Funcao de Saque
  // Chama withdraw(proof, root, nullifierHash, recipient) no contrato
  const withdrawAction = async (
    proof: `0x${string}`,
    root: Address,
    nullifierHash: Address,
    recipient: Address
  ) => {
    if (!walletClient.data) throw new Error('Wallet not connected');
    if (!address) throw new Error('Address not found');

    const { request } = await simulateContract(publicClient, {
      address: BASIC_MIXER_ADDRESS,
      abi: BASIC_MIXER_ABI,
      functionName: 'withdraw',
      args: [proof, root, nullifierHash, recipient],
      account: address,
    });

    const hash = await writeContract(walletClient.data, request);
    return hash;
  };

  return {
    // Dados do contrato
    address,
    isConnected,
    denomination,
    currentRoot,
    nextIndex,
    maxLeaves,

    // Acoes (deposit e withdraw)
    depositAction,
    withdrawAction,

    // Helpers
    refetchNextIndex
  };
}
