import { config as dotenvConfig } from "dotenv";
import { Connection, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider } from "@coral-xyz/anchor";

dotenvConfig();

const SEED_PREFIX_RECEIVED = Buffer.from("received");

function deriveReceivedPda(
  programId: PublicKey,
  emitterChain: number,
  sequence: bigint
): [PublicKey, number] {
  const chainBuf = Buffer.alloc(2);
  chainBuf.writeUInt16LE(emitterChain, 0);
  const seqBuf = Buffer.alloc(8);
  seqBuf.writeBigUInt64LE(sequence, 0);
  return PublicKey.findProgramAddressSync(
    [SEED_PREFIX_RECEIVED, chainBuf, seqBuf],
    programId
  );
}

async function main() {
  const { config } = await import("../../src/cross-chain-messenger/config.js");

  const seq = process.argv[2] || process.env.MESSAGE_SEQUENCE;
  const chainArg = process.argv[3] || process.env.EMITTER_CHAIN || "30";

  if (!seq) {
    console.error("Usage: tsx scripts/cross-chain-messenger/read-message.ts <sequence> [chain]");
    console.error("   chain: 30 = Base (default), 1 = Solana, 2 = Ethereum");
    console.error("\nExample: npm run messenger:read-message -- 5 30");
    process.exit(1);
  }

  const emitterChain = parseInt(chainArg);
  const sequence = BigInt(seq);
  const programId = config.solana.messengerProgramId;

  console.log(`Reading message from Solana messenger program...\n`);
  console.log(`   Program ID: ${programId.toString()}`);
  console.log(`   Emitter Chain: ${emitterChain} (${emitterChain === 30 ? "Base" : emitterChain === 1 ? "Solana" : "Other"})`);
  console.log(`   Sequence: ${sequence}\n`);

  const connection = new Connection(config.solana.rpcUrl, "confirmed");

  const [receivedPda] = deriveReceivedPda(programId, emitterChain, sequence);
  console.log(`   Received PDA: ${receivedPda.toString()}\n`);

  const accountInfo = await connection.getAccountInfo(receivedPda);

  if (!accountInfo) {
    console.log("Message not found. Either:");
    console.log("   - The message hasn't been received yet");
    console.log("   - Wrong sequence number or chain ID");
    process.exit(1);
  }

  console.log("Message found!\n");
  console.log(`   Account size: ${accountInfo.data.length} bytes`);
  console.log(`   Lamports (rent): ${accountInfo.lamports} (${(accountInfo.lamports / 1e9).toFixed(6)} SOL)`);

  const data = accountInfo.data;

  const discriminator = data.slice(0, 8);
  const batchId = data.readUInt32LE(8);
  const wormholeMessageHash = data.slice(12, 44);

  const payloadLen = data.readUInt32LE(44);
  const payloadBytes = data.slice(48, 48 + payloadLen);

  let payloadText: string;
  try {
    payloadText = new TextDecoder().decode(payloadBytes);
  } catch {
    payloadText = `(binary: ${Buffer.from(payloadBytes).toString("hex")})`;
  }

  console.log(`\n--- Received Message ---`);
  console.log(`   Batch ID: ${batchId}`);
  console.log(`   Wormhole Hash: ${Buffer.from(wormholeMessageHash).toString("hex")}`);
  console.log(`   Payload Length: ${payloadLen} bytes`);
  console.log(`   Payload (text): "${payloadText}"`);
  console.log(`   Payload (hex): ${Buffer.from(payloadBytes).toString("hex")}`);
  console.log(`------------------------\n`);

  console.log(`   Solscan account: https://solscan.io/account/${receivedPda.toString()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
