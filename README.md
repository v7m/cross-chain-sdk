# Cross-Chain Bridge

Cross-chain token bridge between EVM and Solana chains using Wormhole protocol.

## Architecture

- **EVM Contract** - Solidity smart contract for EVM chains (Foundry)
- **Solana Program** - Anchor program for Solana blockchain
- **Client** - TypeScript client for testing cross-chain transfers

## Quick Start

### EVM Contract

```bash
cd evm
forge build
forge test
```

See [evm/README.md](./evm/README.md) for details.

### Solana Program

```bash
cd solana
anchor build
anchor test
```

See [solana/README.md](./solana/README.md) for details.

### Test Client

```bash
cd client
npm install
npm run test:evm-to-solana
npm run test:solana-to-evm
```

See [client/README.md](./client/README.md) for details.
