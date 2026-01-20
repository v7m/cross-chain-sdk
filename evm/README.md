# Cross-Chain SDK - EVM Contracts

## Contracts

### CrossChainBridge
Token transfers with payload between EVM and Solana.

### CrossChainMessenger
Generic message passing between chains.

## Build

```bash
forge build
```

## Test

```bash
forge test
```

## Deploy

```bash
# Bridge
forge script script/DeployBridge.s.sol --rpc-url <rpc_url> --private-key <key> --broadcast

# Messenger
forge script script/DeployMessenger.s.sol --rpc-url <rpc_url> --private-key <key> --broadcast
```
