import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
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

const WORMHOLE_PROGRAM_ID = new PublicKey(
  process.env.SOLANA_WORMHOLE_PROGRAM_ID || "worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth"
);

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

async function initializeMessenger() {
  console.log("Initializing Solana Messenger program...\n");

  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const messengerProgramId = new PublicKey(
    process.env.SOLANA_MESSENGER_PROGRAM_ID || ""
  );

  if (!messengerProgramId || messengerProgramId.equals(PublicKey.default)) {
    throw new Error("SOLANA_MESSENGER_PROGRAM_ID not set");
  }

  const connection = new Connection(rpcUrl, "confirmed");
  const payer = loadKeypair();

  console.log(`RPC: ${rpcUrl}`);
  console.log(`Payer: ${payer.publicKey.toString()}`);
  console.log(`Messenger Program: ${messengerProgramId.toString()}`);
  console.log(`Wormhole Program: ${WORMHOLE_PROGRAM_ID.toString()}\n`);

  const projectRoot = path.resolve(__dirname, "../../..");
  const idlPath = path.join(
    projectRoot,
    "solana/target/idl/cross_chain_messenger.json"
  );

  if (!fs.existsSync(idlPath)) {
    throw new Error(`IDL file not found at ${idlPath}`);
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

  const provider = new AnchorProvider(connection, wallet as any, {
    commitment: "confirmed",
  });

  const program = new Program(
    { ...idl, address: messengerProgramId.toString() },
    provider
  );

  // Derive PDAs
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    messengerProgramId
  );

  const [wormholeEmitterPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("emitter")],
    messengerProgramId
  );

  const [wormholeBridgePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("Bridge")],
    WORMHOLE_PROGRAM_ID
  );

  const [wormholeFeeCollectorPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("fee_collector")],
    WORMHOLE_PROGRAM_ID
  );

  const [wormholeSequencePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("Sequence"), wormholeEmitterPda.toBuffer()],
    WORMHOLE_PROGRAM_ID
  );

  // Message PDA for initial "Alive" message (INITIAL_SEQUENCE = 1)
  const INITIAL_SEQUENCE = 1n;
  const sequenceBuffer = Buffer.alloc(8);
  sequenceBuffer.writeBigUInt64LE(INITIAL_SEQUENCE, 0);
  const [wormholeMessagePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("sent"), sequenceBuffer],
    messengerProgramId
  );

  console.log("PDAs:");
  console.log(`  Config: ${configPda.toString()}`);
  console.log(`  Emitter: ${wormholeEmitterPda.toString()}`);
  console.log(`  Wormhole Bridge: ${wormholeBridgePda.toString()}`);
  console.log(`  Fee Collector: ${wormholeFeeCollectorPda.toString()}`);
  console.log(`  Sequence: ${wormholeSequencePda.toString()}`);
  console.log(`  Message: ${wormholeMessagePda.toString()}\n`);

  // Check if already initialized
  const configInfo = await connection.getAccountInfo(configPda);
  if (configInfo) {
    console.log("Messenger already initialized!");
    return;
  }

  console.log("Sending initialize transaction...");

  try {
    const sig = await program.methods
      .initialize()
      .accountsStrict({
        owner: payer.publicKey,
        config: configPda,
        wormholeProgram: WORMHOLE_PROGRAM_ID,
        wormholeBridge: wormholeBridgePda,
        wormholeFeeCollector: wormholeFeeCollectorPda,
        wormholeEmitter: wormholeEmitterPda,
        wormholeSequence: wormholeSequencePda,
        wormholeMessage: wormholeMessagePda,
        clock: SYSVAR_CLOCK_PUBKEY,
        rent: SYSVAR_RENT_PUBKEY,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log(`\nInitialized! TX: ${sig}`);
    console.log(`\nView on Solscan: https://solscan.io/tx/${sig}`);
  } catch (error: any) {
    console.error("Initialize failed:", error.message);
    if (error.logs) {
      console.error("Logs:", error.logs);
    }
    throw error;
  }
}

initializeMessenger().catch((e) => {
  console.error(e);
  process.exit(1);
});
