/**
 * ABI para eventos do BasicMixer
 * Endereço: 0x1EA78439445CA15FDbE6F80d6F2B71E81b560701
 * Chain: sepolia (11155111)
 * StartBlock: 33349712
 */

export const BASIC_MIXER_ABI = [
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "bytes32",
                "name": "commitment",
                "type": "bytes32"
            },
            {
                "indexed": false,
                "internalType": "uint32",
                "name": "leafIndex",
                "type": "uint32"
            }
        ],
        "name": "Deposit",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "recipient",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "bytes32",
                "name": "nullifierHash",
                "type": "bytes32"
            }
        ],
        "name": "Withdrawal",
        "type": "event"
    }
] as const;

export const BASIC_MIXER_ADDRESS = '0x1EA78439445CA15FDbE6F80d6F2B71E81b560701' as `0x${string}`;
export const BASIC_MIXER_START_BLOCK = 33349712n;
