# Cross-Chain SDK - Solana Programs

## Programs

### Cross-Chain Bridge
Token transfers with payload between EVM and Solana.

### Cross-Chain Messenger
Generic message passing between chains.

## Build

```bash
anchor build
```

## Test

```bash
anchor test
```

## Deploy

```bash
# Mainnet
anchor deploy --provider.cluster mainnet

# Devnet
anchor deploy --provider.cluster devnet
```

## Scripts

```bash
# Check program deployment status
node scripts/check-programs.js

# Check wallet balance
node scripts/check-balance.js
```
