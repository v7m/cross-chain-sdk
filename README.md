# Cross-Chain SDK

Cross-chain communication between EVM and Solana using Wormhole protocol.

## Components

- **Cross-Chain Bridge** - Token transfers with payload between chains
- **Cross-Chain Messenger** - Generic message passing between chains

## Architecture

- **EVM Contracts** - Solidity smart contracts (Foundry)
- **Solana Programs** - Anchor programs
- **Client** - TypeScript CLI for cross-chain operations

## Quick Start

### Build

```bash
# EVM
cd evm && forge build

# Solana
cd solana && anchor build

# Client
cd client && npm install
```

---

## Cross-Chain Bridge (Token Transfers)

### Setup (one time)

```bash
cd client
npm run bridge:initialize-solana
npm run bridge:setup
```

### EVM -> Solana

```bash
npm run bridge:test-evm-to-solana
```

### Solana -> EVM

```bash
npm run bridge:test-solana-to-evm
# Note sequence from output, then:
npm run bridge:redeem-evm -- <sequence>
```

---

## Cross-Chain Messenger (Generic Messages)

### Setup (one time)

```bash
cd client
npm run messenger:initialize-solana
npm run messenger:setup
```

### EVM -> Solana

```bash
MESSENGER_PAYLOAD='Hello!' npm run messenger:test-evm-to-solana

# Read message:
npm run messenger:read-message -- <sequence>
```

### Solana -> EVM

```bash
MESSENGER_PAYLOAD='Hello!' npm run messenger:test-solana-to-evm

# Read message:
npm run messenger:read-message-evm -- <tx-hash>
```

### Utility

```bash
# List Received accounts on Solana
npm run messenger:close-received -- --all

# Close account (recover rent)
npm run messenger:close-received -- <chain> <sequence>
```

---

## Documentation

- [Client README](./client/README.md) - Detailed client usage
- [Solana README](./solana/README.md) - Solana programs
- [EVM README](./evm/README.md) - EVM contracts
