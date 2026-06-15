# Parte 2: Frontend (~60 min)

## Setup do Projeto (~10 min)

### Instalar e Rodar

```bash
cd frontend
pnpm install
cp .env.example .env
```

Edite `.env` e configure:
```
VITE_PUBLIC_ENV="development"
VITE_PROJECT_ID="seu_walletconnect_project_id"
```

> `VITE_PROJECT_ID` e necessario para WalletConnect. Crie em [cloud.walletconnect.com](https://cloud.walletconnect.com) ou use o ID fornecido pelo instrutor.

### Atualizar Endereco do Contrato

Se voce deployou um novo contrato na Parte 1, atualize o endereco em `frontend/src/helpers/contract.ts`:

```typescript
export const BASIC_MIXER_ADDRESS = "0xSEU_ENDERECO_AQUI" as Address;
```

### Rodar

```bash
pnpm dev
```

Acesse `http://localhost:5173` no browser. Voce deve ver a UI do BasicMixer.

---

## Walkthrough da Arquitetura (~10 min)

### Visao Geral

```
┌─────────────────────────────────────────────────┐
│                   Browser                        │
│                                                  │
│  WalletProvider (wagmi + RainbowKit)            │
│    ├── config/wagmiConfig.ts  → chain config    │
│    ├── config/client.ts       → viem client     │
│    │                                             │
│    ├── hooks/                                    │
│    │   ├── useBasicMixer     → read/write       │
│    │   ├── useDepositTx      → deposit flow     │
│    │   └── useWithdrawTx     → withdraw flow    │
│    │                                             │
│    ├── helpers/                                  │
│    │   ├── contract.ts       → ABI + address    │
│    │   ├── zk.js             → Poseidon hash    │
│    │   ├── generateProof.ts  → ZK proof (WASM)  │
│    │   └── compute.mjs       → Merkle path      │
│    │                                             │
│    ├── stores/                                   │
│    │   └── commitmentStore   → secret data      │
│    │                                             │
│    └── components/                               │
│        ├── ActionCard        → tabs              │
│        ├── DepositButton     → deposit UI        │
│        └── WithdrawButton    → withdraw UI       │
│                                                  │
│              ↕ wagmi/viem ↕                      │
│        ┌─────────────────┐                       │
│        │ Smart Contract   │                      │
│        │ (Sepolia)        │                      │
│        └─────────────────┘                       │
└─────────────────────────────────────────────────┘
```

### Arquivos-Chave (todos com comentarios didaticos)

| Arquivo | Responsabilidade |
|---------|-----------------|
| `providers/WalletProvider.tsx` | Providers wagmi + RainbowKit + QueryClient |
| `config/wagmiConfig.ts` | Configuracao de chain e wallet |
| `helpers/contract.ts` | ABI e endereco do contrato |
| `helpers/zk.js` | Poseidon hash e Merkle tree no browser |
| `helpers/generateProof.ts` | Pipeline de geracao de prova ZK (WASM) |
| `hooks/useBasicMixer.tsx` | Leitura/escrita do contrato |
| `hooks/useDepositTransaction.tsx` | State machine do deposit |
| `hooks/useWithdrawTransaction.tsx` | State machine do withdraw |
| `stores/commitmentStore.ts` | Encode/decode da nota secreta |
| `scripts/compute.mjs` | Calculo do Merkle path |

---

## Conexao de Wallet (~10 min)

> Abra `providers/WalletProvider.tsx` e `config/wagmiConfig.ts`

### Como funciona

1. **WagmiProvider** envolve toda a app e fornece acesso a blockchain
2. **RainbowKitProvider** adiciona UI de conexao de wallet
3. **QueryClientProvider** faz cache de leituras do contrato

O componente `CustomConnectButton.tsx` usa `ConnectButton.Custom` do RainbowKit para renderizar um botao customizado com 3 estados:
- Nao conectado → "Connect Wallet"
- Chain errada → "Wrong network"
- Conectado → mostra endereco abreviado

**Teste:** Conecte sua MetaMask na Sepolia.

---

## Interacao com o Contrato (~10 min)

> Abra `helpers/contract.ts` e `hooks/useBasicMixer.tsx`

### ABI

A ABI (Application Binary Interface) e o "contrato" entre frontend e smart contract. Define quais funcoes existem, seus parametros, e tipos de retorno.

O arquivo `contract.ts` exporta:
- `BASIC_MIXER_ABI` - a ABI completa
- `BASIC_MIXER_ADDRESS` - endereco do contrato deployado

### Hook useBasicMixer

Este hook encapsula toda a interacao com o contrato:

**Leituras** (sem gas, dados em tempo real):
```typescript
const { denomination, currentRoot, nextIndex, maxLeaves } = useBasicMixer();
```

**Escritas** (custam gas, abrem MetaMask):
```typescript
const { depositAction, withdrawAction } = useBasicMixer();

// Deposit: envia commitment + 0.001 ETH
const txHash = await depositAction(commitment);

// Withdraw: envia prova ZK + dados
const txHash = await withdrawAction(proof, root, nullifierHash, recipient);
```

**Padrao simulateContract + writeContract:**
1. `simulateContract` → executa localmente (verifica se vai funcionar)
2. `writeContract` → envia tx real (abre MetaMask)

---

## Fluxo de Deposit (~20 min)

> Abra: `stores/commitmentStore.ts` → `helpers/zk.js` → `hooks/useDepositTransaction.tsx` → `components/DepositButton.tsx`

### Commitment Store

O `commitmentStore.ts` (Zustand) gerencia os dados secretos:
- `encodeData({secret, nullifier, leafIndex})` → gera nota base64
- `decodeData(base64String)` → restaura secret + nullifier + leafIndex

A "nota encriptada" que o usuario copia e salva e simplesmente:
```
base64(JSON({ secret: "123...", nullifier: "456...", leafIndex: "0" }))
```

### Helpers ZK

`zk.js` fornece:
- `getPoseidon()` → instancia singleton do hash Poseidon
- `randField()` → gera numero aleatorio no campo finito BN254
- `toBytes32()` → converte BigInt para formato Solidity
- `buildZeroes()` → calcula zeros da Merkle tree (igual ao contrato)
- `insertLeaf()` → insere folha na arvore (espelho do contrato)

### State Machine do Deposit

O hook `useDepositTransaction` gerencia o fluxo com estados:

```
IDLE
  ↓ usuario clica "Deposit 0.001 ETH"
GENERATING_COMMITMENT
  ↓ gera secret + nullifier + Poseidon hash
SIMULATING
  ↓ simula tx localmente
AWAITING_SIGNATURE
  ↓ MetaMask abre, usuario assina
SENDING_TRANSACTION
  ↓ tx enviada ao mempool
CONFIRMING_TRANSACTION
  ↓ esperando mineracao
SUCCESS → modal com nota para copiar
  (ou ERROR → toast com mensagem de erro)
```

### DepositButton

O componente consome o hook e renderiza:
- Botao com texto dinamico baseado no estado atual
- Loading spinner durante processamento
- Modal de sucesso forcando o usuario a copiar a nota

**Demo:** Faca um deposit de 0.001 ETH e copie a nota gerada.

---

## Fluxo de Withdraw (~20 min)

> Abra: `scripts/compute.mjs` → `helpers/generateProof.ts` → `hooks/useWithdrawTransaction.tsx` → `components/WithdrawButton.tsx`

### Compute (Merkle Path)

`compute.mjs` e o coracao do withdraw. Ele:
1. Decodifica a nota base64 do usuario
2. Valida que o commitment existe no indexer
3. Reconstroi a Merkle Tree inserindo TODOS os commitments
4. Captura merkle_path e merkle_indices para o circuito
5. Calcula nullifier_hash = Poseidon(nullifier, 0)

### Geracao de Prova ZK

`generateProof.ts` executa o pipeline no browser:

```
1. Inicializa WASM (Noir + ACVM)
2. Carrega circuito compilado (swirl.json)
3. Inicializa Barretenberg (motor criptografico)
4. Gera witness (executa circuito com inputs)
5. Gera prova UltraHonk (~10-30 segundos)
6. Verifica prova localmente (sanity check)
7. Formata para Solidity (hex bytes)
```

A prova e gerada **inteiramente no browser** - o secret e nullifier nunca saem da maquina do usuario.

### State Machine do Withdraw

O hook `useWithdrawTransaction` tem mais passos que o deposit:

```
IDLE
  ↓ usuario cola nota e clica "Withdraw 0.001 ETH"
FETCHING_DATA
  ↓ busca commitments do indexer (ou JSON fallback)
GENERATING_INPUTS
  ↓ reconstroi Merkle tree, calcula path
GENERATING_PROOF
  ↓ gera prova ZK no browser (~10-30s, parte mais pesada)
SIMULATING
  ↓ simula tx
AWAITING_SIGNATURE
  ↓ MetaMask abre
SENDING_TRANSACTION
  ↓ tx no mempool
CONFIRMING_TRANSACTION
  ↓ esperando mineracao
SUCCESS → modal com hash da tx
```

### WithdrawButton

O componente:
- Textarea para colar a nota (auto-decode apos 3s)
- Campo para endereco destinatario (pode ser diferente da wallet)
- Botao com estados dinamicos
- Tratamento de erros especificos (NullifierAlreadyUsed, blacklist, etc.)

**Demo:** Cole a nota do deposit anterior e faca um withdraw.

---

## Checkpoint Final

Ao final do workshop, voce deve ter:

- [x] Circuito Noir compilado e Verifier gerado
- [x] 3 contratos deployados (Verifier, Poseidon, BasicMixer)
- [x] Indexer rodando e indexando eventos
- [x] Frontend compilando e rodando
- [x] Wallet conectada via RainbowKit
- [x] Deposit de 0.001 ETH realizado com sucesso
- [x] Nota encriptada salva
- [x] Withdraw realizado com a nota (prova ZK gerada no browser)
- [x] Entendimento do fluxo completo: ZK circuit → contract → indexer → frontend

## Proximos Passos

- Estudar o circuito Noir em profundidade (`main.nr`)
- Experimentar com denominacoes diferentes
- Adicionar mais funcionalidades (multi-chain, relayer, etc.)
- Explorar o Verifier.sol gerado e entender UltraHonk
- Deployar em mainnet
