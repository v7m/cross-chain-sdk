import { config as dotenvConfig } from "dotenv";
import { ethers } from "ethers";

dotenvConfig();

async function main() {
  const { config } = await import("../../src/cross-chain-messenger/config.js");

  const txHash = process.argv[2];
  if (!txHash) {
    console.error("Usage: tsx scripts/cross-chain-messenger/read-message-evm.ts <tx-hash>");
    console.error("\nExample: npm run messenger:read-message-evm -- 0x123...");
    process.exit(1);
  }

  console.log(`Reading message from EVM transaction...\n`);
  console.log(`   TX Hash: ${txHash}`);
  console.log(`   Contract: ${config.evm.messengerAddress}\n`);

  const provider = new ethers.providers.JsonRpcProvider(config.evm.rpcUrl);

  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) {
    console.error("Transaction not found");
    process.exit(1);
  }

  console.log(`Transaction found!`);
  console.log(`   Block: ${receipt.blockNumber}`);
  console.log(`   Status: ${receipt.status === 1 ? "Success" : "Failed"}`);
  console.log(`   Gas used: ${receipt.gasUsed.toString()}\n`);

  const messageReceivedTopic = ethers.utils.id("MessageReceived(uint16,bytes32,bytes)");

  for (const log of receipt.logs) {
    if (log.topics[0] === messageReceivedTopic) {
      console.log(`--- MessageReceived Event ---`);

      const emitterChain = parseInt(log.topics[1], 16);
      const emitterAddress = log.topics[2];

      const abiCoder = new ethers.utils.AbiCoder();
      const [payload] = abiCoder.decode(["bytes"], log.data);

      let payloadText: string;
      try {
        payloadText = ethers.utils.toUtf8String(payload);
      } catch {
        payloadText = `(binary: ${payload})`;
      }

      console.log(`   Emitter Chain: ${emitterChain} (${emitterChain === 1 ? "Solana" : emitterChain === 30 ? "Base" : "Other"})`);
      console.log(`   Emitter Address: ${emitterAddress}`);
      console.log(`   Payload Length: ${(payload.length - 2) / 2} bytes`);
      console.log(`   Payload (text): "${payloadText}"`);
      console.log(`   Payload (hex): ${payload}`);
      console.log(`-----------------------------\n`);
    }
  }

  console.log(`   BaseScan: https://basescan.org/tx/${txHash}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
