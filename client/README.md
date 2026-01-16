# Cross-Chain Bridge Test Client

TypeScript client for testing cross-chain token transfers between EVM and Solana using Wormhole.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in your configuration:
```bash
cp .env.example .env
```

3. Configure your environment variables:
   - EVM RPC URL and private key
   - Solana RPC URL and private key (base58 encoded)
   - Contract addresses for both chains
   - Wormhole RPC URL (testnet or mainnet)

## Usage

### Test EVM -> Solana Transfer

```bash
npm run test:evm-to-solana
```

This will:
1. Send tokens from EVM to Solana
2. Wait for VAA from Wormhole guardians
3. Redeem tokens on Solana

### Test Solana -> EVM Transfer

```bash
npm run test:solana-to-evm
```

This will:
1. Send tokens from Solana to EVM
2. Wait for VAA from Wormhole guardians
3. Redeem tokens on EVM

## Environment Variables

- `EVM_RPC_URL` - RPC endpoint for EVM chain
- `EVM_PRIVATE_KEY` - Private key for EVM wallet (hex format)
- `EVM_BRIDGE_ADDRESS` - Address of deployed CrossChainBridge contract
- `EVM_WORMHOLE_ADDRESS` - Wormhole core contract address
- `EVM_TOKEN_BRIDGE_ADDRESS` - Token Bridge contract address
- `EVM_CHAIN_ID` - Wormhole chain ID for EVM chain
- `SOLANA_RPC_URL` - RPC endpoint for Solana
- `SOLANA_PRIVATE_KEY` - Private key for Solana wallet (JSON array format)
- `SOLANA_BRIDGE_PROGRAM_ID` - CrossChainBridge program ID
- `SOLANA_WORMHOLE_PROGRAM_ID` - Wormhole program ID
- `SOLANA_TOKEN_BRIDGE_PROGRAM_ID` - Token Bridge program ID
- `WORMHOLE_RPC_URL` - Wormhole guardian RPC endpoint
- `TEST_TOKEN_ADDRESS` - ERC20 token address for testing (EVM)
- `SOLANA_MINT_ADDRESS` - SPL token mint address for testing (Solana)

## Notes

- Make sure both bridges are initialized and foreign contracts are registered
- The client will wait up to 2 minutes for VAA to be available
- For testnet, use `https://wormhole-v2-testnet-api.certus.one`
- For mainnet, use `https://wormhole-v2-mainnet-api.certus.one`
