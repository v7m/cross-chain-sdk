import { config as dotenvConfig } from "dotenv";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { config } from "../../src/cross-chain-messenger/config.js";

dotenvConfig();

const SEED_PREFIX_CONFIG = Buffer.from("config");
const SEED_PREFIX_RECEIVED = Buffer.from("received");

function deriveConfigPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([SEED_PREFIX_CONFIG], programId);
}

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
  const args = process.argv.slice(2);
  
  if (args.length === 0 || (args[0] !== "--all" && args.length < 2)) {
    console.log("Usage: tsx scripts/cross-chain-messenger/close-received.ts <emitter_chain> <sequence>");
    console.log("   or: tsx scripts/cross-chain-messenger/close-received.ts --all");
    console.log("");
    console.log("Examples:");
    console.log("   Close single: npm run messenger:close-received -- 30 5");
    console.log("   Close all:    npm run messenger:close-received -- --all");
    process.exit(1);
  }

  const programId = config.solana.messengerProgramId;
  const connection = new Connection(config.solana.rpcUrl, {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 60000,
  });

  const keypairPath = process.env.SOLANA_KEYPAIR_PATH || 
    path.join(os.homedir(), ".config/solana/id.json");
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const payer = Keypair.fromSecretKey(new Uint8Array(keypairData));

  const idlPath = path.join(
    import.meta.dirname,
    "../../../solana/target/idl/cross_chain_messenger.json"
  );
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

  const wallet = new Wallet(payer);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  const program = new Program(idl, provider);

  const [configPda] = deriveConfigPda(programId);

  if (args[0] === "--all") {
    console.log("Finding all Received accounts...\n");
    
    // Find all accounts owned by our program
    const accounts = await connection.getProgramAccounts(programId);

    // Filter to only Received accounts (minimum size check)
    const receivedAccounts = accounts.filter(acc => acc.account.data.length >= 48);

    if (receivedAccounts.length === 0) {
      console.log("No Received accounts found.");
      return;
    }

    // Try to match accounts to chain/sequence by deriving PDAs
    const knownChains = [30, 1]; // Base, Solana
    const maxSequence = 20;
    
    type FoundAccount = {
      pubkey: string;
      lamports: number;
      chain: number;
      sequence: bigint;
    };
    
    const foundAccounts: FoundAccount[] = [];
    const unmatchedAccounts: { pubkey: string; lamports: number }[] = [];

    for (const account of receivedAccounts) {
      let matched = false;
      
      for (const chain of knownChains) {
        for (let seq = 0n; seq <= BigInt(maxSequence); seq++) {
          const [pda] = deriveReceivedPda(programId, chain, seq);
          if (pda.toString() === account.pubkey.toString()) {
            foundAccounts.push({
              pubkey: account.pubkey.toString(),
              lamports: account.account.lamports,
              chain,
              sequence: seq,
            });
            matched = true;
            break;
          }
        }
        if (matched) break;
      }
      
      if (!matched) {
        unmatchedAccounts.push({
          pubkey: account.pubkey.toString(),
          lamports: account.account.lamports,
        });
      }
    }

    console.log(`Found ${foundAccounts.length} Received account(s):\n`);

    let totalLamports = 0n;
    for (const acc of foundAccounts) {
      totalLamports += BigInt(acc.lamports);
      const sol = acc.lamports / 1e9;
      console.log(`  Chain ${acc.chain}, Seq ${acc.sequence}: ${sol.toFixed(6)} SOL`);
      console.log(`     PDA: ${acc.pubkey}`);
    }

    if (unmatchedAccounts.length > 0) {
      console.log(`\nUnmatched accounts (${unmatchedAccounts.length}):`);
      for (const acc of unmatchedAccounts) {
        totalLamports += BigInt(acc.lamports);
        console.log(`  ${acc.pubkey}: ${(acc.lamports / 1e9).toFixed(6)} SOL`);
      }
    }

    console.log(`\nTotal rent to recover: ${Number(totalLamports) / 1e9} SOL`);
    
    if (foundAccounts.length > 0) {
      console.log("\nTo close accounts:");
      for (const acc of foundAccounts) {
        console.log(`  npm run messenger:close-received -- ${acc.chain} ${acc.sequence}`);
      }
    }
    return;
  }

  const emitterChain = parseInt(args[0]);
  const sequence = BigInt(args[1]);

  const [receivedPda] = deriveReceivedPda(programId, emitterChain, sequence);

  console.log("Closing Received account...");
  console.log(`   Program: ${programId.toString()}`);
  console.log(`   Emitter Chain: ${emitterChain}`);
  console.log(`   Sequence: ${sequence}`);
  console.log(`   Received PDA: ${receivedPda.toString()}`);

  // Check if account exists
  const accountInfo = await connection.getAccountInfo(receivedPda);
  if (!accountInfo) {
    console.log("\nAccount does not exist or already closed.");
    return;
  }

  const lamports = accountInfo.lamports;
  console.log(`   Rent to recover: ${(lamports / 1e9).toFixed(6)} SOL`);

  try {
    const tx = await (program.methods as any)
      .closeReceived(emitterChain, new (await import("@coral-xyz/anchor")).BN(sequence.toString()))
      .accounts({
        payer: payer.publicKey,
        config: configPda,
        owner: payer.publicKey,
        received: receivedPda,
      })
      .rpc();

    console.log(`\nSuccess! TX: ${tx}`);
    console.log(`   Solscan: https://solscan.io/tx/${tx}`);
    console.log(`   Recovered: ${(lamports / 1e9).toFixed(6)} SOL`);
  } catch (e: any) {
    console.error("\nError:", e.message);
    if (e.logs) {
      console.error("Logs:", e.logs.slice(-5).join("\n"));
    }
  }
}

main().catch(console.error);
