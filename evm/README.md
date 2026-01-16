# Cross-Chain Bridge

## EVM Contract

### Functions

1. **sendTokensWithPayload** - Send tokens to another chain via Wormhole
2. **redeemTokensWithPayload** - Receive and process tokens from another chain
3. **registerEmitter** - Register trusted contract from another chain
4. **updateRelayerFee** - Update relayer fee configuration

### State

- **State** - Stores owner, Wormhole config, TokenBridge config, chainId, registered emitters, redeemed transfers

### Structs

- **CrossChainPayload** - Payload structure for cross-chain transfers

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
forge script script/Deploy.s.sol:DeployScript --rpc-url <your_rpc_url> --private-key <your_private_key>
```
