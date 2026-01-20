import { ethers } from "ethers";
import type { ChainId } from "@certusone/wormhole-sdk";
import { config } from "./config.js";

export class EvmMessengerClient {
  private provider: ethers.providers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private messenger: ethers.Contract;

  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(config.evm.rpcUrl);
    this.wallet = new ethers.Wallet(config.evm.privateKey, this.provider);

    const messengerABI = [
      "function sendMessage(bytes memory payload) external payable returns (uint64 sequence)",
      "function receiveMessage(bytes memory encodedVaa) external",
      "function registerEmitter(uint16 emitterChainId, bytes32 emitterAddress) external",
      "function owner() external view returns (address)",
      "function chainId() external view returns (uint16)",
      "function getRegisteredEmitter(uint16 emitterChainId) external view returns (bytes32)",
      "event MessageSent(uint16 indexed targetChain, uint64 indexed sequence, bytes payload)",
      "event MessageReceived(uint16 indexed sourceChain, bytes32 indexed sourceEmitter, bytes payload)",
    ];

    this.messenger = new ethers.Contract(
      config.evm.messengerAddress,
      messengerABI,
      this.wallet
    );
  }

  async sendMessage(payload: string | Uint8Array): Promise<{ sequence: bigint; txHash: string }> {
    const wormholeFee = await this.getWormholeFee();
    console.log(`   Wormhole fee: ${ethers.utils.formatEther(wormholeFee)} ETH`);
    
    const payloadBytes =
      typeof payload === "string" ? ethers.utils.toUtf8Bytes(payload) : payload;

    const balance = await this.provider.getBalance(this.wallet.address);
    
    let estimatedGas = ethers.BigNumber.from(300000);
    try {
      estimatedGas = await this.messenger.estimateGas.sendMessage(payloadBytes, { value: wormholeFee });
      estimatedGas = estimatedGas.mul(150).div(100);
    } catch (error: any) {
      console.log(`   Gas estimation failed, using default: ${estimatedGas.toString()}`);
      if (error.message?.includes("gas required exceeds allowance")) {
        estimatedGas = ethers.BigNumber.from(500000);
      }
    }
    
    const gasPrice = await this.provider.getGasPrice();
    const totalCost = wormholeFee.add(estimatedGas.mul(gasPrice));

    if (balance.lt(totalCost)) {
      throw new Error(
        `Insufficient balance. Need ${ethers.utils.formatEther(totalCost)} ETH, have ${ethers.utils.formatEther(balance)} ETH`
      );
    }

    console.log(`   Using gas limit: ${estimatedGas.toString()}`);

    const tx = await this.messenger.sendMessage(payloadBytes, {
      value: wormholeFee,
      gasLimit: estimatedGas,
    });
    console.log(`   Transaction hash: ${tx.hash}`);
    console.log(`   View on BaseScan: https://basescan.org/tx/${tx.hash}`);
    console.log(`   Waiting for confirmation...`);
    
    let receipt;
    try {
      receipt = await this.provider.waitForTransaction(tx.hash, 1, 60000);
    } catch (error: any) {
      console.log(`   waitForTransaction failed, trying direct receipt lookup...`);
      
      for (let i = 0; i < 30; i++) {
        try {
          receipt = await this.provider.getTransactionReceipt(tx.hash);
          if (receipt) {
            console.log(`   Receipt retrieved! Status: ${receipt.status === 1 ? "success" : "reverted"}`);
            break;
          }
        } catch (e: any) {
          // Receipt not ready yet
        }
        if (i < 29) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    if (!receipt || !receipt.transactionHash) {
      throw new Error(`Could not get receipt after 60 seconds. Transaction may still be pending. Check on BaseScan: https://basescan.org/tx/${tx.hash}`);
    }
    
    if (receipt.status === 0) {
      throw new Error(`Transaction reverted. View on BaseScan: https://basescan.org/tx/${receipt.transactionHash}`);
    }
    
    console.log(`   Transaction confirmed! Block: ${receipt.blockNumber}`);
    
    const { parseSequenceFromLogEth } = await import("@certusone/wormhole-sdk/lib/cjs/bridge/parseSequenceFromLog");
    const sequence = parseSequenceFromLogEth(receipt, config.evm.wormholeAddress);
    
    const { getEmitterAddressEth } = await import("@certusone/wormhole-sdk/lib/cjs/bridge/getEmitterAddress");
    const emitter = getEmitterAddressEth(config.evm.messengerAddress);
    const wormholeScanUrl = `https://wormholescan.io/#/tx/${config.evm.chainId}/${emitter}/${sequence}`;
    console.log(`   Track VAA: ${wormholeScanUrl}`);

    return {
      sequence: BigInt(sequence.toString()),
      txHash: receipt.transactionHash,
    };
  }

  async receiveMessage(vaa: Uint8Array): Promise<string> {
    console.log(`   Sending receiveMessage transaction...`);
    const tx = await this.messenger.receiveMessage(ethers.utils.hexlify(vaa));
    console.log(`   TX hash: ${tx.hash}`);
    console.log(`   Waiting for confirmation...`);
    const receipt = await tx.wait();
    console.log(`   Confirmed in block ${receipt.blockNumber}`);
    return receipt.transactionHash;
  }

  async getWormholeFee(): Promise<ethers.BigNumber> {
    if (!config.evm.wormholeAddress) {
      console.warn("   Warning: EVM_WORMHOLE_ADDRESS not set, using 0 fee");
      return ethers.BigNumber.from(0);
    }
    try {
      const wormholeABI = ["function messageFee() external view returns (uint256)"];
      const wormhole = new ethers.Contract(
        config.evm.wormholeAddress,
        wormholeABI,
        this.provider
      );
      const fee = await wormhole.messageFee();
      return fee;
    } catch (error: any) {
      console.warn(`   Warning: Failed to get Wormhole fee: ${error.message}, using 0`);
      return ethers.BigNumber.from(0);
    }
  }

  async getEmitterAddress(): Promise<string> {
    const { getEmitterAddressEth } = await import("@certusone/wormhole-sdk/lib/cjs/bridge/getEmitterAddress");
    return getEmitterAddressEth(config.evm.messengerAddress);
  }

  async getRegisteredEmitter(chainId: number): Promise<string> {
    return await this.messenger.getRegisteredEmitter(chainId);
  }

  async registerEmitter(chainId: number, emitterAddress: string): Promise<string> {
    const emitterBytes32 = ethers.utils.hexZeroPad(
      ethers.utils.arrayify(emitterAddress),
      32
    );
    const tx = await this.messenger.registerEmitter(chainId, emitterBytes32);
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
    const baseUrl = config.wormhole.rpcUrl.replace("/v1", "") || "https://api.wormholescan.io";

    while (Date.now() - startTime < timeout) {
      try {
        const url = `${baseUrl}/v1/signed_vaa/${emitterChain}/${emitterAddress}/${sequence.toString()}`;
        const response = await fetch(url);

        if (response.ok) {
          const data = await response.json() as { vaaBytes?: string };
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

  getAddress(): string {
    return this.wallet.address;
  }
}
