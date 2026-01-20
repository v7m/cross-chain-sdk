import { config as dotenvConfig } from "dotenv";
import { PublicKey } from "@solana/web3.js";

dotenvConfig();

export const config = {
  evm: {
    rpcUrl: process.env.EVM_RPC_URL || "http://localhost:8545",
    privateKey: process.env.EVM_PRIVATE_KEY || "",
    messengerAddress: process.env.EVM_MESSENGER_ADDRESS || "",
    wormholeAddress: process.env.EVM_WORMHOLE_ADDRESS || "",
    chainId: parseInt(process.env.EVM_CHAIN_ID || "2"),
  },
  solana: {
    rpcUrl: process.env.SOLANA_RPC_URL || "http://localhost:8899",
    privateKey: process.env.SOLANA_PRIVATE_KEY || "",
    messengerProgramId: new PublicKey(
      process.env.SOLANA_MESSENGER_PROGRAM_ID || ""
    ),
    wormholeProgramId: new PublicKey(
      process.env.SOLANA_WORMHOLE_PROGRAM_ID ||
        "worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth"
    ),
  },
  wormhole: {
    rpcUrl: process.env.WORMHOLE_RPC_URL || "https://api.wormholescan.io",
  },
};

export const WORMHOLE_CHAIN_IDS = {
  SOLANA: 1,
  ETHEREUM: 2,
  BASE: 30,
} as const;
