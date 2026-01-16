import { EvmClient } from "./evm-client.js";
import { SolanaClient } from "./solana-client.js";
import { config, WORMHOLE_CHAIN_IDS } from "./config.js";
import { PublicKey } from "@solana/web3.js";
import { parseTokenTransferVaa } from "@certusone/wormhole-sdk";
import { ethers } from "ethers";

async function testSolanaToEvm() {
  console.log("Starting Solana -> EVM cross-chain test\n");

  const evmClient = new EvmClient();
  const solanaClient = new SolanaClient();

  const evmAddress = evmClient.getAddress();
  const solanaAddress = solanaClient.getAddress();

  console.log(`Solana Address: ${solanaAddress.toString()}`);
  console.log(`EVM Address: ${evmAddress}\n`);

  const mintAddress = process.env.SOLANA_MINT_ADDRESS;
  if (!mintAddress) {
    throw new Error("SOLANA_MINT_ADDRESS not set in environment");
  }

  const mint = new PublicKey(mintAddress);
  const amount = BigInt(1000000);
  const batchId = 0;

  console.log("Step 1: Sending tokens from Solana to EVM");
  console.log(`   Mint: ${mint.toString()}`);
  console.log(`   Amount: ${amount}`);
  console.log(`   Target Chain: Ethereum (${WORMHOLE_CHAIN_IDS.ETHEREUM})`);
  console.log(`   Target Recipient: ${evmAddress}\n`);

  const recipientBytes = Buffer.alloc(32);
  const evmAddressBytes = Buffer.from(ethers.getBytes(evmAddress));
  evmAddressBytes.copy(recipientBytes, 12);

  const { sequence, signature } = await solanaClient.sendNativeTokens(
    mint,
    amount,
    WORMHOLE_CHAIN_IDS.ETHEREUM,
    recipientBytes,
    batchId
  );

  console.log(`Transaction sent: ${signature}`);
  console.log(`   Sequence: ${sequence}\n`);

  console.log("Step 2: Waiting for VAA from Wormhole guardians...");
  
  const emitterAddress = await solanaClient.getEmitterAddress();
  console.log(`   Emitter Address: ${emitterAddress}\n`);

  const vaa = await solanaClient.waitForVAA(
    WORMHOLE_CHAIN_IDS.SOLANA,
    emitterAddress,
    sequence,
    120000
  );

  console.log(`VAA received (${vaa.length} bytes)\n`);

  const parsedVaa = parseTokenTransferVaa(vaa);
  
  console.log("Step 3: Redeeming tokens on EVM");
  console.log(`   Token Chain: ${parsedVaa.tokenChain}`);
  console.log(`   Token Address: ${Buffer.from(parsedVaa.tokenAddress).toString("hex")}\n`);

  const redeemTxHash = await evmClient.redeemTokens(vaa);

  console.log(`Tokens redeemed on EVM: ${redeemTxHash}\n`);

  console.log("Cross-chain transfer completed successfully!");
  console.log(`   Solana TX: ${signature}`);
  console.log(`   EVM Redeem TX: ${redeemTxHash}`);
}

testSolanaToEvm().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
