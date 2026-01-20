import { ethers } from "ethers";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import BN from "bn.js";
import { config as dotenvConfig } from "dotenv";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { fileURLToPath } from "url";

dotenvConfig();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function testSolanaToEvm() {
  console.log("Starting Solana -> EVM cross-chain test\n");

  const solanaRpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const evmRpcUrl = process.env.EVM_RPC_URL || "https://mainnet.base.org";
  const evmPrivateKey = process.env.EVM_PRIVATE_KEY || "";

  const bridgeProgramId = new PublicKey(
    process.env.SOLANA_BRIDGE_PROGRAM_ID || "5HVG1XFoN3KXa6gcFkCs7iFcHvtsbmY6drvP34S1mwn4"
  );
  const tokenBridgeProgramId = new PublicKey(
    process.env.SOLANA_TOKEN_BRIDGE_PROGRAM_ID || "wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb"
  );
  const wormholeProgramId = new PublicKey(
    process.env.SOLANA_WORMHOLE_PROGRAM_ID || "worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth"
  );

  const mintAddress = process.env.SOLANA_MINT_ADDRESS;
  if (!mintAddress) {
    throw new Error("SOLANA_MINT_ADDRESS not set in environment");
  }
  const mint = new PublicKey(mintAddress);

  const connection = new Connection(solanaRpcUrl, "confirmed");
  const payer = loadKeypair();

  const evmProvider = new ethers.providers.JsonRpcProvider(evmRpcUrl);
  const evmWallet = new ethers.Wallet(evmPrivateKey, evmProvider);

  console.log(`Solana Address: ${payer.publicKey.toString()}`);
  console.log(`EVM Address: ${evmWallet.address}\n`);

  const amount = new BN(1000000);
  const targetChain = parseInt(process.env.EVM_CHAIN_ID || "30");
  const batchId = 0;

  const recipientBytes = Buffer.alloc(32);
  const evmAddressBytes = Buffer.from(evmWallet.address.slice(2), "hex");
  evmAddressBytes.copy(recipientBytes, 12);

  console.log("Step 1: Sending tokens from Solana to Base");
  console.log(`   Mint: ${mint.toString()}`);
  console.log(`   Amount: ${amount} (1 USDC)`);
  console.log(`   Target Chain: ${targetChain} (Base)`);
  console.log(`   Target Recipient: ${evmWallet.address}\n`);

  const idlPath = path.join(__dirname, "../../../../solana/target/idl/cross_chain_bridge.json");
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

  const [senderConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("sender")],
    bridgeProgramId
  );

  const chainIdBuffer = Buffer.alloc(2);
  chainIdBuffer.writeUInt16LE(targetChain);

  const [foreignContract] = PublicKey.findProgramAddressSync(
    [Buffer.from("foreign_contract"), chainIdBuffer],
    bridgeProgramId
  );

  const [tmpTokenAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from("tmp"), mint.toBuffer()],
    bridgeProgramId
  );

  const [tokenBridgeConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    tokenBridgeProgramId
  );

  const [tokenBridgeCustody] = PublicKey.findProgramAddressSync(
    [mint.toBuffer()],
    tokenBridgeProgramId
  );

  const [tokenBridgeAuthoritySigner] = PublicKey.findProgramAddressSync(
    [Buffer.from("authority_signer")],
    tokenBridgeProgramId
  );

  const [tokenBridgeCustodySigner] = PublicKey.findProgramAddressSync(
    [Buffer.from("custody_signer")],
    tokenBridgeProgramId
  );

  const [tokenBridgeEmitter] = PublicKey.findProgramAddressSync(
    [Buffer.from("emitter")],
    tokenBridgeProgramId
  );

  const [wormholeBridge] = PublicKey.findProgramAddressSync(
    [Buffer.from("Bridge")],
    wormholeProgramId
  );

  const [wormholeFeeCollector] = PublicKey.findProgramAddressSync(
    [Buffer.from("fee_collector")],
    wormholeProgramId
  );

  const [tokenBridgeSequence] = PublicKey.findProgramAddressSync(
    [Buffer.from("Sequence"), tokenBridgeEmitter.toBuffer()],
    wormholeProgramId
  );

  const sequenceAccount = await connection.getAccountInfo(tokenBridgeSequence);
  let currentSequence = BigInt(0);
  if (sequenceAccount && sequenceAccount.data.length >= 8) {
    currentSequence = sequenceAccount.data.readBigUInt64LE(0);
  }

  const nextSequence = currentSequence + BigInt(1);
  console.log(`   Current sequence: ${currentSequence}, next: ${nextSequence}`);

  const sequenceBuffer = Buffer.alloc(8);
  sequenceBuffer.writeBigUInt64LE(nextSequence);

  const [wormholeMessage] = PublicKey.findProgramAddressSync(
    [Buffer.from("bridged"), sequenceBuffer],
    bridgeProgramId
  );

  console.log(`   Wormhole message PDA: ${wormholeMessage.toString()}`);

  const fromTokenAccount = getAssociatedTokenAddressSync(mint, payer.publicKey);
  console.log(`   From token account: ${fromTokenAccount.toString()}`);

  const tokenAccountInfo = await connection.getTokenAccountBalance(fromTokenAccount);
  console.log(`   Token balance: ${tokenAccountInfo.value.uiAmountString} (raw: ${tokenAccountInfo.value.amount})`);

  if (BigInt(tokenAccountInfo.value.amount) < amount.toNumber()) {
    throw new Error(`Insufficient token balance. Have: ${tokenAccountInfo.value.amount}, need: ${amount.toString()}`);
  }

  console.log("Sending transaction...");

  try {
    const signature = await program.methods
      .sendNativeTokensWithPayload(
        batchId,
        amount,
        [...recipientBytes],
        targetChain
      )
      .accounts({
        payer: payer.publicKey,
        config: senderConfig,
        foreignContract: foreignContract,
        mint: mint,
        fromTokenAccount: fromTokenAccount,
        tmpTokenAccount: tmpTokenAccount,
        wormholeProgram: wormholeProgramId,
        tokenBridgeProgram: tokenBridgeProgramId,
        tokenBridgeConfig: tokenBridgeConfig,
        tokenBridgeCustody: tokenBridgeCustody,
        tokenBridgeAuthoritySigner: tokenBridgeAuthoritySigner,
        tokenBridgeCustodySigner: tokenBridgeCustodySigner,
        wormholeBridge: wormholeBridge,
        wormholeMessage: wormholeMessage,
        tokenBridgeEmitter: tokenBridgeEmitter,
        tokenBridgeSequence: tokenBridgeSequence,
        wormholeFeeCollector: wormholeFeeCollector,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        clock: SYSVAR_CLOCK_PUBKEY,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([payer])
      .rpc();

    console.log(`\nTransaction sent: ${signature}`);
    console.log(`   VAA Sequence: ${currentSequence}\n`);

    console.log("Step 2: Waiting for VAA from Wormhole guardians...");
    console.log("   This may take 1-2 minutes...\n");
    console.log("   You can check the status at:");
    console.log(`   https://wormholescan.io/#/tx/${signature}\n`);

    console.log("Once the VAA is ready, redeem with:");
    console.log(`   npm run bridge:redeem-evm -- ${currentSequence}\n`);

    console.log("Solana transaction completed!");
    console.log(`   Signature: ${signature}`);
  } catch (error: any) {
    console.error("Transaction failed:", error);
    if (error.logs) {
      console.error("Logs:", error.logs);
    }
    throw error;
  }
}

testSolanaToEvm().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
