# Cross-Chain Bridge

## Solana Program

### Instructions

1. **initialize** - Setup bridge config and Wormhole integration
2. **register_emitter** - Register trusted contract from another chain
3. **send_message** - Send payload to another chain via Wormhole
4. **receive_message** - Receive and process message from another chain

### Accounts

- **BridgeConfig** - Stores owner, Wormhole config
- **ForeignEmitter** - Trusted contract address from foreign chain
- **ReceivedMessage** - Stores received message data

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
anchor deploy --provider.cluster devnet
```
