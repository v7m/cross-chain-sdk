import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import type { ChainId } from "@certusone/wormhole-sdk";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { config } from "./config.js";

const SEED_PREFIX_SENT = Buffer.from("sent");
const SEED_PREFIX_CONFIG = Buffer.from("config");
const SEED_PREFIX_EMITTER = Buffer.from("emitter");
const SEED_PREFIX_FOREIGN_EMITTER = Buffer.from("foreign_emitter");
const SEED_PREFIX_RECEIVED = Buffer.from("received");

function deriveConfigPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([SEED_PREFIX_CONFIG], programId);
}

function deriveWormholeEmitterPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([SEED_PREFIX_EMITTER], programId);
}

function deriveWormholeMessagePda(
  programId: PublicKey,
  sequence: bigint
): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(sequence, 0);
  return PublicKey.findProgramAddressSync([SEED_PREFIX_SENT, buf], programId);
}

function deriveForeignEmitterPda(
  programId: PublicKey,
  chain: number
): [PublicKey, number] {
  const chainBuf = Buffer.alloc(2);
  chainBuf.writeUInt16LE(chain, 0);
  return PublicKey.findProgramAddressSync(
    [SEED_PREFIX_FOREIGN_EMITTER, chainBuf],
    programId
  );
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

export class SolanaMessengerClient {
  private connection: Connection;
  private payer: Keypair;
  private programId: PublicKey;
  private wormholeProgramId: PublicKey;

  constructor() {
    this.connection = new Connection(config.solana.rpcUrl, {
      commitment: "confirmed",
      confirmTransactionInitialTimeout: 60000,
    });
    
    const privateKeyEnv = process.env.SOLANA_PRIVATE_KEY;
    if (privateKeyEnv) {
      try {
        const keyArray = JSON.parse(privateKeyEnv);
        this.payer = Keypair.fromSecretKey(Uint8Array.from(keyArray));
      } catch {
        const decoded = Buffer.from(privateKeyEnv, "base64");
        this.payer = Keypair.fromSecretKey(decoded);
      }
    } else {
      const walletPath =
        process.env.SOLANA_KEYPAIR_PATH ||
        path.join(os.homedir(), ".config", "solana", "id.json");
      const walletData = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
      this.payer = Keypair.fromSecretKey(Uint8Array.from(walletData));
    }
    
    this.programId = config.solana.messengerProgramId;
    this.wormholeProgramId = config.solana.wormholeProgramId;
  }

  async sendMessage(
    payload: string | Uint8Array
  ): Promise<{ sequence: bigint; signature: string }> {
    const payloadBytes =
      typeof payload === "string" ? new TextEncoder().encode(payload) : payload;

    const { default: IDL } = await import(
      "../../../solana/target/idl/cross_chain_messenger.json"
    );

    const wallet = {
      publicKey: this.payer.publicKey,
      signTransaction: async <T extends Transaction>(tx: T): Promise<T> => {
        tx.sign(this.payer);
        return tx;
      },
      signAllTransactions: async <T extends Transaction>(
        txs: T[]
      ): Promise<T[]> => {
        for (const tx of txs) {
          tx.sign(this.payer);
        }
        return txs;
      },
    };

    const provider = new AnchorProvider(this.connection, wallet as any, {
      commitment: "confirmed",
    });
    const program = new Program(
      { ...IDL, address: this.programId.toString() },
      provider
    );

    const [configPda] = deriveConfigPda(this.programId);
    const accountNamespace = program.account as any;
    const configAccount = (await accountNamespace.config.fetch(configPda)) as any;
    const wormhole = configAccount.wormhole;
    const wormholeBridge = new PublicKey(wormhole.bridge);
    const wormholeFeeCollector = new PublicKey(wormhole.feeCollector || wormhole.fee_collector);

    const [wormholeEmitterPda] = deriveWormholeEmitterPda(this.programId);
    
    // Use sequence from config (required by address constraint in program)
    const wormholeSequence = new PublicKey(wormhole.sequence);

    // Sequence account stores the current sequence value (plain u64, no discriminator)
    const seqAccount = await this.connection.getAccountInfo(wormholeSequence, "confirmed");
    const currentSequence =
      seqAccount && seqAccount.data.length >= 8
        ? seqAccount.data.readBigUInt64LE(0)
        : 1n;

    // wormhole-anchor-sdk next_value() returns value + 1 (doesn't mutate)
    // PDA seeds use next_value(), but VAA will have currentSequence
    const nextValue = currentSequence + 1n;

    const [wormholeMessagePda] = deriveWormholeMessagePda(
      this.programId,
      nextValue
    );

    const sig = await program.methods
      .sendMessage(Buffer.from(payloadBytes))
      .accountsStrict({
        payer: this.payer.publicKey,
        config: configPda,
        wormholeProgram: this.wormholeProgramId,
        wormholeBridge,
        wormholeFeeCollector,
        wormholeEmitter: wormholeEmitterPda,
        wormholeSequence,
        wormholeMessage: wormholeMessagePda,
        systemProgram: SystemProgram.programId,
        clock: SYSVAR_CLOCK_PUBKEY,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    return { sequence: currentSequence, signature: sig };
  }

  async receiveMessage(vaa: Uint8Array): Promise<string> {
    const { postVaaWithRetry } = await import("@certusone/wormhole-sdk/lib/cjs/solana/sendAndConfirmPostVaa");
    const { parseVaa } = await import("@certusone/wormhole-sdk/lib/cjs/vaa/wormhole");

    const vaaBuffer = Buffer.from(vaa);
    const parsed = parseVaa(vaaBuffer);
    
    console.log(`   VAA details: chain=${parsed.emitterChain}, emitter=${Buffer.from(parsed.emitterAddress).toString("hex")}, sequence=${parsed.sequence}, signatures=${parsed.guardianSignatures.length}`);

    try {
      console.log(`   Posting VAA to Wormhole (this may take a moment)...`);
      await postVaaWithRetry(
        this.connection,
        async (tx: Transaction) => {
          tx.feePayer = this.payer.publicKey;
          tx.partialSign(this.payer);
          return tx;
        },
        this.wormholeProgramId,
        this.payer.publicKey,
        vaaBuffer,
        5,
        "confirmed"
      );
      console.log(`   VAA posted successfully`);
    } catch (error: any) {
      const errorMsg = error.message || String(error);
      console.error(`   postVaa failed: ${errorMsg}`);
      
      if (errorMsg.includes("429") || errorMsg.includes("Too Many Requests")) {
        console.error(`   RPC rate limit exceeded. Solutions:`);
        console.error(`   1. Wait 1-2 minutes and try again`);
        console.error(`   2. Use a different Solana RPC endpoint (set SOLANA_RPC_URL)`);
        console.error(`   3. Use a paid RPC provider for better rate limits`);
      } else if (errorMsg.includes("Missing signature")) {
        console.error(`   Transaction signing issue. VAA has ${parsed.guardianSignatures.length} signatures.`);
        console.error(`   This might be due to RPC rate limiting or network issues.`);
        console.error(`   Try again in 30-60 seconds or use a different RPC endpoint.`);
      }
      throw error;
    }

    const vaaHash = new Uint8Array(parsed.hash);

    const { default: IDL } = await import(
      "../../../solana/target/idl/cross_chain_messenger.json"
    );

    const wallet = {
      publicKey: this.payer.publicKey,
      signTransaction: async <T extends Transaction>(tx: T): Promise<T> => {
        tx.sign(this.payer);
        return tx;
      },
      signAllTransactions: async <T extends Transaction>(
        txs: T[]
      ): Promise<T[]> => {
        for (const tx of txs) {
          tx.sign(this.payer);
        }
        return txs;
      },
    };

    const provider = new AnchorProvider(this.connection, wallet as any, {
      commitment: "confirmed",
    });
    const program = new Program(
      { ...IDL, address: this.programId.toString() },
      provider
    );

    const { derivePostedVaaKey } = await import(
      "@certusone/wormhole-sdk/lib/cjs/solana/wormhole/accounts/postedVaa.js"
    );

    const [configPda] = deriveConfigPda(this.programId);
    const postedPda = derivePostedVaaKey(this.wormholeProgramId, parsed.hash);
    const [foreignEmitterPda] = deriveForeignEmitterPda(
      this.programId,
      parsed.emitterChain
    );
    const [receivedPda] = deriveReceivedPda(
      this.programId,
      parsed.emitterChain,
      parsed.sequence
    );

    const sig = await program.methods
      .receiveMessage(Array.from(vaaHash))
      .accountsStrict({
        payer: this.payer.publicKey,
        config: configPda,
        wormholeProgram: this.wormholeProgramId,
        posted: postedPda,
        foreignEmitter: foreignEmitterPda,
        received: receivedPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return sig;
  }

  async waitForVAA(
    emitterChain: ChainId,
    emitterAddress: string,
    sequence: bigint,
    timeout: number = 60000
  ): Promise<Uint8Array> {
    const startTime = Date.now();
    const baseUrl = config.wormhole.rpcUrl.replace("/v1", "") || "https://api.wormholescan.io";

    while (Date.now() - startTime < timeout) {
      try {
        const url = `${baseUrl}/v1/signed_vaa/${emitterChain}/${emitterAddress}/${sequence.toString()}`;
        const response = await fetch(url);

        if (response.ok) {
          const data = (await response.json()) as { vaaBytes?: string };
          if (data.vaaBytes) {
            const vaaBytes = Buffer.from(data.vaaBytes, "base64");
            return new Uint8Array(vaaBytes);
          }
        }
      } catch {
        // API not ready yet, retry
      }

      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`Waiting for VAA... (${elapsed}s elapsed)`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    throw new Error(`Timeout waiting for VAA after ${timeout}ms`);
  }

  async getEmitterAddress(): Promise<string> {
    const [emitterPda] = deriveWormholeEmitterPda(this.programId);
    return Buffer.from(emitterPda.toBytes()).toString("hex");
  }

  getAddress(): PublicKey {
    return this.payer.publicKey;
  }
}
