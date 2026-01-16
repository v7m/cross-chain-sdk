import { EvmClient } from "./evm-client.js";
import { SolanaClient } from "./solana-client.js";
import { config, WORMHOLE_CHAIN_IDS } from "./config.js";
import { PublicKey } from "@solana/web3.js";
import { parseTokenTransferVaa, ChainId } from "@certusone/wormhole-sdk";
import { ethers } from "ethers";

async function testEvmToSolana() {
  console.log("Starting EVM -> Solana cross-chain test\n");

  const evmClient = new EvmClient();
  const solanaClient = new SolanaClient();

  const evmAddress = evmClient.getAddress();
  const solanaAddress = solanaClient.getAddress();

  console.log(`EVM Address: ${evmAddress}`);
  console.log(`Solana Address: ${solanaAddress.toString()}\n`);

  const tokenAddress = config.test.tokenAddress;
  if (!tokenAddress) {
    throw new Error("TEST_TOKEN_ADDRESS not set in environment");
  }

  const amount = ethers.parseUnits("1", 18);
  const batchId = 0;

  console.log("Step 1: Sending tokens from EVM to Solana");
  console.log(`   Token: ${tokenAddress}`);
  console.log(`   Amount: ${ethers.formatUnits(amount, 18)}`);
  console.log(`   Target Chain: Solana (${WORMHOLE_CHAIN_IDS.SOLANA})`);
  console.log(`   Target Recipient: ${solanaAddress.toString()}\n`);

  const recipientBytes32 = ethers.zeroPadValue(
    solanaAddress.toBuffer(),
    32
  );

  const { sequence, txHash } = await evmClient.sendTokens(
    tokenAddress,
    amount,
    WORMHOLE_CHAIN_IDS.SOLANA,
    recipientBytes32,
    batchId
  );

  console.log(`Transaction sent: ${txHash}`);
  console.log(`   Sequence: ${sequence}\n`);

  console.log("Step 2: Waiting for VAA from Wormhole guardians...");
  
  const emitterAddress = await evmClient.getEmitterAddress();
  console.log(`   Emitter Address: ${emitterAddress}\n`);

  const vaa = await evmClient.waitForVAA(
    config.evm.chainId as ChainId,
    emitterAddress,
    sequence,
    120000
  );

  console.log(`VAA received (${vaa.length} bytes)\n`);

  const parsedVaa = parseTokenTransferVaa(vaa);
  const isNative = parsedVaa.tokenChain === WORMHOLE_CHAIN_IDS.SOLANA;
  
  console.log("Step 3: Redeeming tokens on Solana");
  console.log(`   Token Chain: ${parsedVaa.tokenChain}`);
  console.log(`   Token Address: ${Buffer.from(parsedVaa.tokenAddress).toString("hex")}`);
  console.log(`   Is Native Token: ${isNative}\n`);

  let redeemSignature: string;
  if (isNative) {
    redeemSignature = await solanaClient.redeemNativeTransfer(vaa);
  } else {
    redeemSignature = await solanaClient.redeemWrappedTransfer(vaa);
  }

  console.log(`Tokens redeemed on Solana: ${redeemSignature}\n`);

  console.log("Cross-chain transfer completed successfully!");
  console.log(`   EVM TX: ${txHash}`);
  console.log(`   Solana Redeem TX: ${redeemSignature}`);
}

testEvmToSolana().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
