import { config as dotenvConfig } from "dotenv";
import { PublicKey } from "@solana/web3.js";
import { CHAINS } from "@certusone/wormhole-sdk";

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
        "3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5"
    ),
    tokenBridgeProgramId: new PublicKey(
      process.env.SOLANA_TOKEN_BRIDGE_PROGRAM_ID ||
        "DZnkkTmCiFWfYTfT41X3Rd1kDgozqzxWaHqsw6W4x2oe"
    ),
  },
  wormhole: {
    rpcUrl: process.env.WORMHOLE_RPC_URL || "https://wormhole-v2-testnet-api.certus.one",
  },
  test: {
    tokenAddress: process.env.TEST_TOKEN_ADDRESS || "",
  },
};

export const WORMHOLE_CHAIN_IDS = {
  SOLANA: CHAINS.solana,
  ETHEREUM: CHAINS.ethereum,
};
