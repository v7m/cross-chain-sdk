import { ethers } from "ethers";
import {
  getEmitterAddressEth,
  parseSequenceFromLogEth,
  getSignedVAAWithRetry,
  parseTokenTransferVaa,
  tryNativeToHexString,
  ChainId,
} from "@certusone/wormhole-sdk";
import { config, WORMHOLE_CHAIN_IDS } from "./config.js";

export class EvmClient {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private bridge: ethers.Contract;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.evm.rpcUrl);
    this.wallet = new ethers.Wallet(config.evm.privateKey, this.provider);
    
    const bridgeABI = [
      "function sendTokensWithPayload(address token, uint256 amount, uint16 targetChain, bytes32 targetRecipient, uint32 batchId) external payable returns (uint64 sequence)",
      "function redeemTokensWithPayload(bytes memory encodedVaa) external",
      "function registerEmitter(uint16 emitterChainId, bytes32 emitterAddress) external",
      "function owner() external view returns (address)",
      "function chainId() external view returns (uint16)",
      "function getRegisteredEmitter(uint16 emitterChainId) external view returns (bytes32)",
      "event TokensSent(uint16 indexed targetChain, bytes32 indexed targetRecipient, uint256 amount, uint64 sequence)",
      "event TokensRedeemed(uint16 indexed sourceChain, bytes32 indexed sourceEmitter, address indexed recipient, address token, uint256 amount)",
    ];

    this.bridge = new ethers.Contract(
      config.evm.bridgeAddress,
      bridgeABI,
      this.wallet
    );
  }

  async sendTokens(
    tokenAddress: string,
    amount: bigint,
    targetChain: number,
    targetRecipient: string,
    batchId: number = 0
  ): Promise<{ sequence: bigint; txHash: string }> {
    const wormholeFee = await this.getWormholeFee();
    
    const targetRecipientBytes32 = ethers.zeroPadValue(
      ethers.getBytes(targetRecipient),
      32
    );

    const tx = await this.bridge.sendTokensWithPayload(
      tokenAddress,
      amount,
      targetChain,
      targetRecipientBytes32,
      batchId,
      { value: wormholeFee }
    );

    const receipt = await tx.wait();
    const sequence = parseSequenceFromLogEth(receipt, config.evm.wormholeAddress);

    return {
      sequence: BigInt(sequence),
      txHash: receipt.hash,
    };
  }

  async redeemTokens(vaa: Uint8Array): Promise<string> {
    const tx = await this.bridge.redeemTokensWithPayload(ethers.getBytes(vaa));
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async getWormholeFee(): Promise<bigint> {
    const wormholeABI = [
      "function messageFee() external view returns (uint256)",
    ];
    const wormhole = new ethers.Contract(
      config.evm.wormholeAddress,
      wormholeABI,
      this.provider
    );
    return await wormhole.messageFee();
  }

  async getEmitterAddress(): Promise<string> {
    return getEmitterAddressEth(config.evm.bridgeAddress);
  }

  async getRegisteredEmitter(chainId: number): Promise<string> {
    return await this.bridge.getRegisteredEmitter(chainId);
  }

  async registerEmitter(chainId: number, emitterAddress: string): Promise<string> {
    const emitterBytes32 = ethers.zeroPadValue(
      ethers.getBytes(emitterAddress),
      32
    );
    const tx = await this.bridge.registerEmitter(chainId, emitterBytes32);
    const receipt = await tx.wait();
    return receipt.hash;
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

  addressToBytes32(address: string): string {
    return ethers.zeroPadValue(ethers.getBytes(address), 32);
  }

  getAddress(): string {
    return this.wallet.address;
  }
}
