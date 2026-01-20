import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  getAccount,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import {
  getSignedVAAWithRetry,
} from "@certusone/wormhole-sdk";
import type { ChainId } from "@certusone/wormhole-sdk";
import * as crossChainBridge from "../../../../solana/ts/sdk/cross_chain_bridge/index.js";
import { config, WORMHOLE_CHAIN_IDS } from "./config.js";

export class SolanaClient {
  private connection: Connection;
  private payer: Keypair;
  private bridgeProgramId: PublicKey;
  private wormholeProgramId: PublicKey;
  private tokenBridgeProgramId: PublicKey;

  constructor() {
    this.connection = new Connection(config.solana.rpcUrl, "confirmed");

    const privateKeyBytes = Uint8Array.from(
      JSON.parse(config.solana.privateKey)
    );
    this.payer = Keypair.fromSecretKey(privateKeyBytes);

    this.bridgeProgramId = config.solana.bridgeProgramId;
    this.wormholeProgramId = config.solana.wormholeProgramId;
    this.tokenBridgeProgramId = config.solana.tokenBridgeProgramId;
  }

  async sendNativeTokens(
    mint: PublicKey,
    amount: bigint,
    recipientChain: number,
    recipientAddress: Buffer,
    batchId: number = 0
  ): Promise<{ sequence: bigint; signature: string }> {
    const { getProgramSequenceTracker } = await import("@certusone/wormhole-sdk/lib/cjs/solana/wormhole");

    const instruction = await crossChainBridge.createSendNativeTokensWithPayloadInstruction(
      this.connection,
      this.bridgeProgramId,
      this.payer.publicKey,
      this.tokenBridgeProgramId,
      this.wormholeProgramId,
      mint,
      {
        batchId,
        amount,
        recipientAddress,
        recipientChain: recipientChain as ChainId,
      }
    );

    const transaction = new Transaction().add(instruction);
    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.payer],
      { commitment: "confirmed" }
    );

    const trackerAfter = await getProgramSequenceTracker(
      this.connection,
      this.tokenBridgeProgramId,
      this.wormholeProgramId
    );
    const sequence = trackerAfter.value();

    return {
      sequence,
      signature,
    };
  }

  async sendWrappedTokens(
    mint: PublicKey,
    amount: bigint,
    recipientChain: number,
    recipientAddress: Buffer,
    batchId: number = 0
  ): Promise<{ sequence: bigint; signature: string }> {
    const { getProgramSequenceTracker } = await import("@certusone/wormhole-sdk/lib/cjs/solana/wormhole");

    const instruction = await crossChainBridge.createSendWrappedTokensWithPayloadInstruction(
      this.connection,
      this.bridgeProgramId,
      this.payer.publicKey,
      this.tokenBridgeProgramId,
      this.wormholeProgramId,
      mint,
      {
        batchId,
        amount,
        recipientAddress,
        recipientChain: recipientChain as ChainId,
      }
    );

    const transaction = new Transaction().add(instruction);
    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.payer],
      { commitment: "confirmed" }
    );

    const trackerAfter = await getProgramSequenceTracker(
      this.connection,
      this.tokenBridgeProgramId,
      this.wormholeProgramId
    );
    const sequence = trackerAfter.value();

    return {
      sequence,
      signature,
    };
  }

  async redeemNativeTransfer(vaa: Uint8Array): Promise<string> {
    const instruction = await crossChainBridge.createRedeemNativeTransferWithPayloadInstruction(
      this.connection,
      this.bridgeProgramId,
      this.payer.publicKey,
      this.tokenBridgeProgramId,
      this.wormholeProgramId,
      vaa
    );

    const transaction = new Transaction().add(instruction);
    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.payer],
      { commitment: "confirmed" }
    );

    return signature;
  }

  async redeemWrappedTransfer(vaa: Uint8Array): Promise<string> {
    const instruction = await crossChainBridge.createRedeemWrappedTransferWithPayloadInstruction(
      this.connection,
      this.bridgeProgramId,
      this.payer.publicKey,
      this.tokenBridgeProgramId,
      this.wormholeProgramId,
      vaa
    );

    const transaction = new Transaction().add(instruction);
    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.payer],
      { commitment: "confirmed" }
    );

    return signature;
  }

  async waitForVAA(
    emitterChain: ChainId,
    emitterAddress: string,
    sequence: bigint,
    timeout: number = 60000
  ): Promise<Uint8Array> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const { vaaBytes } = await getSignedVAAWithRetry(
          [config.wormhole.rpcUrl],
          emitterChain,
          emitterAddress,
          sequence.toString()
        );

        if (vaaBytes) {
          return vaaBytes;
        }
      } catch (error) {
        console.log(`Waiting for VAA... (${Date.now() - startTime}ms elapsed)`);
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error(`Timeout waiting for VAA after ${timeout}ms`);
  }

  async getEmitterAddress(): Promise<string> {
    const { deriveWormholeEmitterKey } = await import("@certusone/wormhole-sdk/lib/cjs/solana/wormhole");
    const emitterKey = deriveWormholeEmitterKey(this.tokenBridgeProgramId);
    const emitterBytes = emitterKey.toBytes();
    return Buffer.from(emitterBytes).toString("hex");
  }

  async ensureTokenAccount(mint: PublicKey): Promise<PublicKey> {
    const tokenAccount = getAssociatedTokenAddressSync(mint, this.payer.publicKey);

    try {
      await getAccount(this.connection, tokenAccount);
      return tokenAccount;
    } catch (error) {
      const instruction = createAssociatedTokenAccountInstruction(
        this.payer.publicKey,
        tokenAccount,
        this.payer.publicKey,
        mint
      );

      const transaction = new Transaction().add(instruction);
      await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.payer]
      );

      return tokenAccount;
    }
  }

  async registerForeignContract(
    chainId: number,
    contractAddress: string
  ): Promise<string> {
    let contractAddressBuffer = Buffer.from(contractAddress.slice(2), "hex");
    if (contractAddressBuffer.length !== 32) {
      const padded = Buffer.alloc(32);
      contractAddressBuffer.copy(padded, 12);
      contractAddressBuffer = padded;
    }

    const tokenBridgeForeignAddress = await this.getTokenBridgeForeignAddress(chainId);

    const instruction = await crossChainBridge.createRegisterForeignContractInstruction(
      this.connection,
      this.bridgeProgramId,
      this.payer.publicKey,
      this.tokenBridgeProgramId,
      chainId as ChainId,
      contractAddressBuffer,
      tokenBridgeForeignAddress
    );

    const transaction = new Transaction().add(instruction);
    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.payer],
      { commitment: "confirmed" }
    );

    return signature;
  }

  async getRegisteredForeignContract(chainId: number): Promise<string> {
    const { deriveForeignContractKey } = await import("../../../../solana/ts/sdk/cross_chain_bridge/accounts/foreignContract.js");
    const foreignContractKey = deriveForeignContractKey(this.bridgeProgramId, chainId as ChainId);

    const accountInfo = await this.connection.getAccountInfo(foreignContractKey);
    if (!accountInfo) {
      return "0x0000000000000000000000000000000000000000000000000000000000000000";
    }

    const addressBuffer = accountInfo.data.slice(2, 34);
    return "0x" + Buffer.from(addressBuffer).toString("hex");
  }

  async getTokenBridgeForeignAddress(chainId: number): Promise<string> {
    if (chainId === WORMHOLE_CHAIN_IDS.ETHEREUM) {
      return config.evm.tokenBridgeAddress || "0xDB5492265f6038831E89f495970ff09e8Ee4bC61";
    }
    if (chainId === WORMHOLE_CHAIN_IDS.BASE) {
      return config.evm.tokenBridgeAddress || "0x8d2de8d2f73F1F4cAB472AC9A881C9b123C79627";
    }
    throw new Error(`Token Bridge address not configured for chain ${chainId}`);
  }

  getAddress(): PublicKey {
    return this.payer.publicKey;
  }
}
