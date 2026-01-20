# Cross-Chain Client

TypeScript client for cross-chain communication between EVM (Base) and Solana using Wormhole.

## Setup

```bash
npm install
cp .env.example .env
# Fill in your configuration in .env
```

---

## Cross-Chain Bridge (Token Transfers)

Transfer tokens between EVM and Solana with payload.

### Initial Setup (one time)

```bash
# Initialize Solana program
npm run bridge:initialize-solana

# Register foreign contracts on both chains
npm run bridge:setup
```

### EVM -> Solana

```bash
# Step 1: Send tokens from EVM
npm run bridge:test-evm-to-solana

# The script will automatically:
# - Send tokens
# - Wait for VAA
# - Redeem on Solana
```

### Solana -> EVM

```bash
# Step 1: Send tokens from Solana
npm run bridge:test-solana-to-evm
# Note the sequence number from output

# Step 2: Redeem on EVM (after VAA is ready, ~1-2 min)
npm run bridge:redeem-evm -- <sequence>
```

---

## Cross-Chain Messenger (Generic Messages)

Send arbitrary messages between chains.

### Initial Setup (one time)

```bash
# Initialize Solana program
npm run messenger:initialize-solana

# Register emitters on both chains
npm run messenger:setup
```

### EVM -> Solana Flow

```bash
# Step 1: Send message from EVM
MESSENGER_PAYLOAD='Hello from Base!' npm run messenger:test-evm-to-solana
# Wait for VAA and automatic redeem (~2-3 min)

# Step 2: Read message on Solana
npm run messenger:read-message -- <sequence>
```

**Or manually:**

```bash
# Step 1: Send message (Ctrl+C after TX confirmed)
MESSENGER_PAYLOAD='Hello from Base!' npm run messenger:test-evm-to-solana

# Step 2: Redeem on Solana (after ~1-2 min)
npm run messenger:redeem-solana -- <sequence>

# Step 3: Read message
npm run messenger:read-message -- <sequence>
```

### Solana -> EVM Flow

```bash
# Step 1: Send message from Solana
MESSENGER_PAYLOAD='Hello from Solana!' npm run messenger:test-solana-to-evm
# Wait for VAA and automatic redeem (~2-3 min)

# Step 2: Read message on EVM
npm run messenger:read-message-evm -- <tx-hash>
```

**Or manually:**

```bash
# Step 1: Send message (Ctrl+C after TX confirmed)
MESSENGER_PAYLOAD='Hello from Solana!' npm run messenger:test-solana-to-evm

# Step 2: Redeem on EVM (after ~1-2 min)
npm run messenger:redeem-evm -- <sequence>

# Step 3: Read message
npm run messenger:read-message-evm -- <tx-hash>
```

### Utility Commands

```bash
# Check EVM wallet balance
npm run messenger:check-balance

# List all Received accounts on Solana (shows rent to recover)
npm run messenger:close-received -- --all

# Close specific Received account (owner only)
npm run messenger:close-received -- <chain> <sequence>
# Example: npm run messenger:close-received -- 30 5
```

---

## Environment Variables

### Bridge

| Variable | Description |
|----------|-------------|
| `EVM_RPC_URL` | RPC endpoint for EVM chain |
| `EVM_PRIVATE_KEY` | Private key for EVM wallet (hex) |
| `EVM_BRIDGE_ADDRESS` | CrossChainBridge contract address |
| `EVM_WORMHOLE_ADDRESS` | Wormhole core contract address |
| `EVM_TOKEN_BRIDGE_ADDRESS` | Token Bridge contract address |
| `EVM_CHAIN_ID` | Wormhole chain ID (30 for Base) |
| `SOLANA_RPC_URL` | RPC endpoint for Solana |
| `SOLANA_PRIVATE_KEY` | Private key (JSON array) |
| `SOLANA_BRIDGE_PROGRAM_ID` | CrossChainBridge program ID |
| `SOLANA_WORMHOLE_PROGRAM_ID` | Wormhole program ID |
| `SOLANA_TOKEN_BRIDGE_PROGRAM_ID` | Token Bridge program ID |
| `WORMHOLE_RPC_URL` | Wormhole API endpoint |

### Messenger

| Variable | Description |
|----------|-------------|
| `EVM_MESSENGER_ADDRESS` | CrossChainMessenger contract address |
| `SOLANA_MESSENGER_PROGRAM_ID` | CrossChainMessenger program ID |
| `MESSENGER_PAYLOAD` | (optional) Message payload for tests |

---

## Notes

- VAA typically takes 1-2 minutes to be signed by guardians
- Solana redeem costs ~$1 (rent deposit for Received account)
- EVM redeem costs only gas
- For mainnet: `WORMHOLE_RPC_URL=https://api.wormholescan.io`
