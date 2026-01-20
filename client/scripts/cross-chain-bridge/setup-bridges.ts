import { ethers } from "ethers";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { config as dotenvConfig } from "dotenv";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { fileURLToPath } from "url";

dotenvConfig();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORMHOLE_CHAIN_IDS = {
  SOLANA: 1,
  ETHEREUM: 2,
  BASE: 30,
} as const;

function getEmitterAddressEth(address: string): string {
  return ethers.utils.hexZeroPad(address, 32).slice(2);
}

function loadKeypair(): Keypair {
  const privateKeyEnv = process.env.SOLANA_PRIVATE_KEY;
  if (privateKeyEnv) {
    try {
      const keyArray = JSON.parse(privateKeyEnv);
      return Keypair.fromSecretKey(Uint8Array.from(keyArray));
    } catch {
      const decoded = Buffer.from(privateKeyEnv, "base64");
      return Keypair.fromSecretKey(decoded);
    }
  }

  const walletPath =
    process.env.SOLANA_KEYPAIR_PATH ||
    path.join(os.homedir(), ".config", "solana", "id.json");
  const walletData = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(walletData));
}

async function setupBridges() {
  console.log("Setting up bridges for cross-chain communication\n");

  const evmRpcUrl = process.env.EVM_RPC_URL || "https://mainnet.base.org";
  const evmPrivateKey = process.env.EVM_PRIVATE_KEY || "";
  const evmBridgeAddress = process.env.EVM_BRIDGE_ADDRESS || "";
  const evmChainId = parseInt(process.env.EVM_CHAIN_ID || "30");

  const solanaRpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const solanaBridgeProgramId = new PublicKey(
    process.env.SOLANA_BRIDGE_PROGRAM_ID || "5HVG1XFoN3KXa6gcFkCs7iFcHvtsbmY6drvP34S1mwn4"
  );
  const solanaTokenBridgeProgramId = new PublicKey(
    process.env.SOLANA_TOKEN_BRIDGE_PROGRAM_ID || "wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb"
  );

  if (!evmBridgeAddress) {
    throw new Error("EVM_BRIDGE_ADDRESS not set in environment");
  }

  const provider = new ethers.providers.JsonRpcProvider(evmRpcUrl);
  const evmWallet = new ethers.Wallet(evmPrivateKey, provider);

  const bridgeABI = [
    "function registerEmitter(uint16 emitterChainId, bytes32 emitterAddress) external",
    "function getRegisteredEmitter(uint16 emitterChainId) external view returns (bytes32)",
  ];
  const evmBridge = new ethers.Contract(evmBridgeAddress, bridgeABI, evmWallet);

  const connection = new Connection(solanaRpcUrl, "confirmed");
  const payer = loadKeypair();

  console.log("Step 1: Getting emitter addresses\n");

  const evmEmitterAddress = getEmitterAddressEth(evmBridgeAddress);
  console.log(`EVM Bridge Address: ${evmBridgeAddress}`);
  console.log(`EVM Emitter Address: 0x${evmEmitterAddress}\n`);

  const [solanaEmitterPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("emitter")],
    solanaTokenBridgeProgramId
  );
  const solanaEmitterAddress = solanaEmitterPDA.toBuffer().toString("hex");
  console.log(`Solana Program ID: ${solanaBridgeProgramId.toString()}`);
  console.log(`Solana Emitter Address: ${solanaEmitterAddress}\n`);

  console.log("Step 2: Registering emitters\n");

  console.log("Registering Solana emitter on EVM...");
  const solanaEmitterBytes32 = "0x" + solanaEmitterAddress;
  const evmTx = await evmBridge.registerEmitter(WORMHOLE_CHAIN_IDS.SOLANA, solanaEmitterBytes32);
  const evmReceipt = await evmTx.wait();
  console.log(`EVM TX: ${evmReceipt.transactionHash}\n`);

  console.log("Registering EVM emitter on Solana...");

  const idlPath = path.join(
    __dirname,
    "../../../../solana/target/idl/cross_chain_bridge.json"
  );
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

  const wallet = {
    publicKey: payer.publicKey,
    signTransaction: async <T extends Transaction>(tx: T): Promise<T> => {
      tx.sign(payer);
      return tx;
    },
    signAllTransactions: async <T extends Transaction>(txs: T[]): Promise<T[]> => {
      for (const tx of txs) {
        tx.sign(payer);
      }
      return txs;
    },
  };

  const anchorProvider = new AnchorProvider(connection, wallet as any, {
    commitment: "confirmed",
  });
  const program = new Program(idl, anchorProvider);

  const [configPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("sender")],
    solanaBridgeProgramId
  );

  const chainIdBuffer = Buffer.alloc(2);
  chainIdBuffer.writeUInt16LE(evmChainId);

  const [foreignContractPDA] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("foreign_contract"),
      chainIdBuffer,
    ],
    solanaBridgeProgramId
  );

  const evmTokenBridgeAddress = process.env.EVM_TOKEN_BRIDGE_ADDRESS || "0x8d2de8d2f73F1F4cAB472AC9A881C9b123C79627";
  let tokenBridgeEmitterBuffer = Buffer.from(evmTokenBridgeAddress.slice(2), "hex");
  if (tokenBridgeEmitterBuffer.length === 20) {
    const padded = Buffer.alloc(32);
    tokenBridgeEmitterBuffer.copy(padded, 12);
    tokenBridgeEmitterBuffer = padded;
  }

  const chainIdBE = Buffer.alloc(2);
  chainIdBE.writeUInt16BE(evmChainId);

  const [tokenBridgeForeignEndpointPDA] = PublicKey.findProgramAddressSync(
    [
      chainIdBE,
      tokenBridgeEmitterBuffer,
    ],
    solanaTokenBridgeProgramId
  );

  let evmAddressBuffer = Buffer.from(evmEmitterAddress, "hex");
  if (evmAddressBuffer.length === 20) {
    const padded = Buffer.alloc(32);
    evmAddressBuffer.copy(padded, 12);
    evmAddressBuffer = padded;
  }

  try {
    const solanaSignature = await program.methods
      .registerForeignContract(evmChainId, [...evmAddressBuffer])
      .accounts({
        owner: payer.publicKey,
        config: configPDA,
        foreignContract: foreignContractPDA,
        tokenBridgeForeignEndpoint: tokenBridgeForeignEndpointPDA,
        tokenBridgeProgram: solanaTokenBridgeProgramId,
      })
      .signers([payer])
      .rpc();

    console.log(`Solana TX: ${solanaSignature}\n`);
  } catch (error: any) {
    if (error.message?.includes("already in use")) {
      console.log("EVM emitter already registered on Solana\n");
    } else {
      throw error;
    }
  }

  console.log("Step 3: Verifying registration\n");

  const registeredSolanaEmitter = await evmBridge.getRegisteredEmitter(WORMHOLE_CHAIN_IDS.SOLANA);
  console.log(`EVM registered Solana emitter: ${registeredSolanaEmitter}`);
  if (registeredSolanaEmitter.toLowerCase() === solanaEmitterBytes32.toLowerCase()) {
    console.log("Solana emitter registered correctly on EVM\n");
  } else {
    console.log("ERROR: Solana emitter registration mismatch!\n");
  }

  console.log("Bridge setup completed!");
  console.log("\nYou can now use the bridge for cross-chain transfers:");
  console.log("  npm run bridge:test-evm-to-solana");
  console.log("  npm run bridge:test-solana-to-evm");
}

setupBridges().catch((error) => {
  console.error("Setup failed:", error);
  process.exit(1);
});
