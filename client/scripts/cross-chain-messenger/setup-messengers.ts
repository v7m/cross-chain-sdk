import { ethers } from "ethers";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
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

const WORMHOLE_CHAIN_IDS = { SOLANA: 1, ETHEREUM: 2, BASE: 30 } as const;

function getEmitterAddressEth(address: string): string {
  return ethers.utils.hexZeroPad(address, 32).slice(2);
}

function loadKeypair(): Keypair {
  const privateKeyEnv = process.env.SOLANA_PRIVATE_KEY;
  if (privateKeyEnv) {
    try {
      return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(privateKeyEnv)));
    } catch {
      return Keypair.fromSecretKey(Buffer.from(privateKeyEnv, "base64"));
    }
  }
  const walletPath =
    process.env.SOLANA_KEYPAIR_PATH ||
    path.join(os.homedir(), ".config", "solana", "id.json");
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );
}

function deriveEmitterPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("emitter")],
    programId
  );
}

async function setupMessengers() {
  console.log("Setting up cross-chain messengers\n");

  const evmRpcUrl = process.env.EVM_RPC_URL || "https://mainnet.base.org";
  const evmPrivateKey = process.env.EVM_PRIVATE_KEY || "";
  const evmMessengerAddress = process.env.EVM_MESSENGER_ADDRESS || "";

  const solanaRpcUrl =
    process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const messengerProgramId = new PublicKey(
    process.env.SOLANA_MESSENGER_PROGRAM_ID || ""
  );
  const evmChainId = parseInt(process.env.EVM_CHAIN_ID || "30");

  if (!evmMessengerAddress) {
    throw new Error("EVM_MESSENGER_ADDRESS not set");
  }

  const provider = new ethers.providers.JsonRpcProvider(evmRpcUrl);
  const evmWallet = new ethers.Wallet(evmPrivateKey, provider);

  const messengerABI = [
    "function registerEmitter(uint16 emitterChainId, bytes32 emitterAddress) external",
    "function getRegisteredEmitter(uint16 emitterChainId) external view returns (bytes32)",
  ];
  const evmMessenger = new ethers.Contract(
    evmMessengerAddress,
    messengerABI,
    evmWallet
  );

  const connection = new Connection(solanaRpcUrl, "confirmed");
  const payer = loadKeypair();

  console.log("Step 1: Emitter addresses\n");

  const evmEmitterHex = getEmitterAddressEth(evmMessengerAddress);
  console.log(`EVM Messenger: ${evmMessengerAddress}`);
  console.log(`EVM Emitter: 0x${evmEmitterHex}\n`);

  const [solanaEmitterPda] = deriveEmitterPda(messengerProgramId);
  const solanaEmitterHex = Buffer.from(solanaEmitterPda.toBytes()).toString(
    "hex"
  );
  console.log(`Solana Messenger: ${messengerProgramId.toString()}`);
  console.log(`Solana Emitter: ${solanaEmitterHex}\n`);

  console.log("Step 2: Registering emitters\n");

  console.log("Registering Solana emitter on EVM...");
  const evmTx = await evmMessenger.registerEmitter(
    WORMHOLE_CHAIN_IDS.SOLANA,
    "0x" + solanaEmitterHex
  );
  await evmTx.wait();
  console.log(`EVM TX: ${evmTx.hash}\n`);

  console.log("Registering EVM emitter on Solana...");

  const projectRoot = path.resolve(__dirname, "../../..");
  const idlPath = path.join(
    projectRoot,
    "solana/target/idl/cross_chain_messenger.json"
  );
  
  if (!fs.existsSync(idlPath)) {
    console.error(`\n❌ IDL file not found at: ${idlPath}`);
    console.error(`\n📝 Please run the following command to generate IDL:\n`);
    console.error(`   cd ${path.join(projectRoot, "solana")}`);
    console.error(`   anchor build\n`);
    throw new Error(
      `IDL file not found. Run 'anchor build' in the solana directory first.`
    );
  }
  
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

  const wallet = {
    publicKey: payer.publicKey,
    signTransaction: async <T extends Transaction>(tx: T): Promise<T> => {
      tx.sign(payer);
      return tx;
    },
    signAllTransactions: async <T extends Transaction>(txs: T[]): Promise<T[]> => {
      for (const tx of txs) tx.sign(payer);
      return txs;
    },
  };

  const program = new Program(
    { ...idl, address: messengerProgramId.toString() },
    new AnchorProvider(connection, wallet as any, { commitment: "confirmed" })
  );

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    messengerProgramId
  );
  const chainBuf = Buffer.alloc(2);
  chainBuf.writeUInt16LE(evmChainId, 0);
  const [foreignEmitterPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("foreign_emitter"), chainBuf],
    messengerProgramId
  );

  const evmEmitterBytes = Buffer.from(evmEmitterHex, "hex");
  const evmEmitterArr = new Array(32);
  for (let i = 0; i < 32; i++) evmEmitterArr[i] = evmEmitterBytes[i];

  try {
    const sig = await program.methods
      .registerEmitter(evmChainId, evmEmitterArr)
      .accountsStrict({
        owner: payer.publicKey,
        config: configPda,
        foreignEmitter: foreignEmitterPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(`Solana TX: ${sig}\n`);
  } catch (e: any) {
    if (e.message?.includes("already in use")) {
      console.log("EVM emitter already registered on Solana\n");
    } else throw e;
  }

  console.log("Step 3: Verifying\n");
  const reg = await evmMessenger.getRegisteredEmitter(WORMHOLE_CHAIN_IDS.SOLANA);
  console.log(`EVM has Solana emitter: ${reg}`);
  console.log(
    reg.toLowerCase() === "0x" + solanaEmitterHex.toLowerCase()
      ? "OK\n"
      : "MISMATCH\n"
  );
  console.log("Messenger setup done. Use test-evm-to-solana / test-solana-to-evm.");
}

setupMessengers().catch((e) => {
  console.error(e);
  process.exit(1);
});
