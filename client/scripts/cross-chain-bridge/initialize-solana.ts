import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
  SystemProgram,
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

function loadKeypair(): Keypair {
  const privateKey = process.env.SOLANA_PRIVATE_KEY;
  const walletPath = process.env.SOLANA_KEYPAIR_PATH || path.join(os.homedir(), ".config", "solana", "id.json");

  if (privateKey) {
    const privateKeyBytes = Uint8Array.from(JSON.parse(privateKey));
    return Keypair.fromSecretKey(privateKeyBytes);
  }

  if (fs.existsSync(walletPath)) {
    const keypairData = JSON.parse(fs.readFileSync(walletPath, "utf8"));
    return Keypair.fromSecretKey(Uint8Array.from(keypairData));
  }

  throw new Error(
    "No keypair found. Set SOLANA_PRIVATE_KEY env variable or ensure ~/.config/solana/id.json exists"
  );
}

async function initializeSolanaBridge() {
  console.log("Initializing Solana bridge...\n");

  const rpcUrl = process.env.SOLANA_RPC_URL || "http://localhost:8899";
  const bridgeProgramId = process.env.SOLANA_BRIDGE_PROGRAM_ID || "5HVG1XFoN3KXa6gcFkCs7iFcHvtsbmY6drvP34S1mwn4";
  const tokenBridgeProgramId = process.env.SOLANA_TOKEN_BRIDGE_PROGRAM_ID || "wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb";
  const wormholeProgramId = process.env.SOLANA_WORMHOLE_PROGRAM_ID || "worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth";

  const connection = new Connection(rpcUrl, "confirmed");
  const payer = loadKeypair();

  const bridgeProgramPubkey = new PublicKey(bridgeProgramId);
  const tokenBridgeProgramPubkey = new PublicKey(tokenBridgeProgramId);
  const wormholeProgramPubkey = new PublicKey(wormholeProgramId);

  console.log(`RPC URL: ${rpcUrl}`);
  console.log(`Bridge Program ID: ${bridgeProgramPubkey.toString()}`);
  console.log(`Token Bridge Program ID: ${tokenBridgeProgramPubkey.toString()}`);
  console.log(`Wormhole Program ID: ${wormholeProgramPubkey.toString()}\n`);

  const relayerFee = 100;
  const relayerFeePrecision = 10000;

  console.log(`Relayer Fee: ${relayerFee}/${relayerFeePrecision} (${(relayerFee / relayerFeePrecision * 100).toFixed(2)}%)\n`);

  console.log("Loading IDL and creating program interface...");
  const { default: IDL } = await import("../../../../solana/target/idl/cross_chain_bridge.json");

  const wallet = {
    publicKey: payer.publicKey,
    signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
      if (tx instanceof Transaction) {
        tx.sign(payer);
      } else {
        tx.sign([payer]);
      }
      return tx;
    },
    signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => {
      for (const tx of txs) {
        if (tx instanceof Transaction) {
          tx.sign(payer);
        } else {
          tx.sign([payer]);
        }
      }
      return txs;
    },
  } as any;

  const provider = new AnchorProvider(
    connection,
    wallet,
    { commitment: "confirmed" }
  );

  const idlWithAddress = {
    ...IDL,
    metadata: {
      ...IDL.metadata,
      address: bridgeProgramPubkey.toString(),
    },
  } as any;

  const program = new Program(idlWithAddress, provider);

  console.log("Deriving Token Bridge PDAs...");
  const [tokenBridgeConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    tokenBridgeProgramPubkey
  );
  const [tokenBridgeAuthoritySigner] = PublicKey.findProgramAddressSync(
    [Buffer.from("authority_signer")],
    tokenBridgeProgramPubkey
  );
  const [tokenBridgeCustodySigner] = PublicKey.findProgramAddressSync(
    [Buffer.from("custody_signer")],
    tokenBridgeProgramPubkey
  );
  const [tokenBridgeEmitter] = PublicKey.findProgramAddressSync(
    [Buffer.from("emitter")],
    tokenBridgeProgramPubkey
  );
  const [tokenBridgeSequence] = PublicKey.findProgramAddressSync(
    [Buffer.from("Sequence"), tokenBridgeEmitter.toBuffer()],
    wormholeProgramPubkey
  );
  const [tokenBridgeMintAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint_signer")],
    tokenBridgeProgramPubkey
  );
  const [wormholeBridge] = PublicKey.findProgramAddressSync(
    [Buffer.from("Bridge")],
    wormholeProgramPubkey
  );
  const [wormholeFeeCollector] = PublicKey.findProgramAddressSync(
    [Buffer.from("fee_collector")],
    wormholeProgramPubkey
  );

  const [senderConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("sender")],
    bridgeProgramPubkey
  );
  const [redeemerConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("redeemer")],
    bridgeProgramPubkey
  );

  console.log("Creating initialize instruction...");
  const tx = await program.methods
    .initialize(relayerFee, relayerFeePrecision)
    .accounts({
      owner: payer.publicKey,
      senderConfig,
      redeemerConfig,
      tokenBridgeProgram: tokenBridgeProgramPubkey,
      wormholeProgram: wormholeProgramPubkey,
      tokenBridgeConfig,
      tokenBridgeAuthoritySigner,
      tokenBridgeCustodySigner,
      tokenBridgeMintAuthority,
      wormholeBridge,
      tokenBridgeEmitter,
      tokenBridgeSequence,
      wormholeFeeCollector,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc();

  console.log(`Bridge initialized!`);
  console.log(`Transaction signature: ${tx}\n`);

  console.log("Verifying initialization...");
  const senderConfigInfo = await connection.getAccountInfo(senderConfig);
  const redeemerConfigInfo = await connection.getAccountInfo(redeemerConfig);

  if (senderConfigInfo && redeemerConfigInfo) {
    console.log("Sender config account created");
    console.log("Redeemer config account created");
    console.log("\nBridge is ready to use!");
  } else {
    console.log("Warning: Could not verify config accounts");
  }
}

initializeSolanaBridge().catch((error) => {
  console.error("Initialization failed:", error);
  process.exit(1);
});
