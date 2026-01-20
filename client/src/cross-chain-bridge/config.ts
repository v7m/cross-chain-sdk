import { config as dotenvConfig } from "dotenv";
import { PublicKey } from "@solana/web3.js";

dotenvConfig();

export const config = {
  evm: {
    rpcUrl: process.env.EVM_RPC_URL || "http://localhost:8545",
    privateKey: process.env.EVM_PRIVATE_KEY || "",
    bridgeAddress: process.env.EVM_BRIDGE_ADDRESS || "",
    wormholeAddress: process.env.EVM_WORMHOLE_ADDRESS || "",
    tokenBridgeAddress: process.env.EVM_TOKEN_BRIDGE_ADDRESS || "",
    chainId: parseInt(process.env.EVM_CHAIN_ID || "2"),
  },
  solana: {
    rpcUrl: process.env.SOLANA_RPC_URL || "http://localhost:8899",
    privateKey: process.env.SOLANA_PRIVATE_KEY || "",
    bridgeProgramId: new PublicKey(
      process.env.SOLANA_BRIDGE_PROGRAM_ID ||
        "5HVG1XFoN3KXa6gcFkCs7iFcHvtsbmY6drvP34S1mwn4"
    ),
    wormholeProgramId: new PublicKey(
      process.env.SOLANA_WORMHOLE_PROGRAM_ID ||
        "worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth"
    ),
    tokenBridgeProgramId: new PublicKey(
      process.env.SOLANA_TOKEN_BRIDGE_PROGRAM_ID ||
        "wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb"
    ),
  },
  wormhole: {
    rpcUrl: process.env.WORMHOLE_RPC_URL || "https://api.wormholescan.io",
  },
  test: {
    tokenAddress: process.env.TEST_TOKEN_ADDRESS || "",
  },
};

export const WORMHOLE_CHAIN_IDS = {
  SOLANA: 1,
  ETHEREUM: 2,
  BASE: 30,
} as const;
