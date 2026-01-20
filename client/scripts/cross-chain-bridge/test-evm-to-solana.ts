import { ethers } from "ethers";
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
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  getEmitterAddressEth,
  parseSequenceFromLogEth,
  getSignedVAAWithRetry,
  parseTokenTransferVaa,
} from "@certusone/wormhole-sdk";
import type { ChainId } from "@certusone/wormhole-sdk";
import { config as dotenvConfig } from "dotenv";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { fileURLToPath } from "url";

dotenvConfig();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORMHOLE_CHAIN_IDS = {
  SOLANA: 1,
  ETHEREUM: 2,
  BASE: 30,
} as const;

function loadSolanaKeypair(): Keypair {
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

async function getWormholeFee(
  provider: ethers.providers.JsonRpcProvider,
  wormholeAddress: string
): Promise<ethers.BigNumber> {
  const wormholeABI = ["function messageFee() external view returns (uint256)"];
  const wormhole = new ethers.Contract(wormholeAddress, wormholeABI, provider);
  return await wormhole.messageFee();
}

async function waitForVAA(
  wormholeRpcUrl: string,
  emitterChain: ChainId,
  emitterAddress: string,
  sequence: bigint,
  timeout: number = 120000
): Promise<Uint8Array> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const { vaaBytes } = await getSignedVAAWithRetry(
        [wormholeRpcUrl],
        emitterChain,
        emitterAddress,
        sequence.toString()
      );

      if (vaaBytes) {
        return vaaBytes;
      }
    } catch {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`   Waiting for VAA... (${elapsed}s elapsed)`);
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  throw new Error(`Timeout waiting for VAA after ${timeout}ms`);
}

async function testEvmToSolana() {
  console.log("Starting EVM -> Solana cross-chain test\n");

  const evmRpcUrl = process.env.EVM_RPC_URL || "https://mainnet.base.org";
  const evmPrivateKey = process.env.EVM_PRIVATE_KEY || "";
  const evmBridgeAddress = process.env.EVM_BRIDGE_ADDRESS || "";
  const evmWormholeAddress = process.env.EVM_WORMHOLE_ADDRESS || "";
  const evmChainId = parseInt(process.env.EVM_CHAIN_ID || "30");
  const wormholeRpcUrl =
    process.env.WORMHOLE_RPC_URL || "https://api.wormholescan.io";

  const solanaRpcUrl =
    process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const bridgeProgramId = new PublicKey(
    process.env.SOLANA_BRIDGE_PROGRAM_ID ||
      "5HVG1XFoN3KXa6gcFkCs7iFcHvtsbmY6drvP34S1mwn4"
  );
  const tokenBridgeProgramId = new PublicKey(
    process.env.SOLANA_TOKEN_BRIDGE_PROGRAM_ID ||
      "wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb"
  );
  const wormholeProgramId = new PublicKey(
    process.env.SOLANA_WORMHOLE_PROGRAM_ID ||
      "worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth"
  );

  const tokenAddress = process.env.TEST_TOKEN_ADDRESS;
  if (!tokenAddress) {
    throw new Error("TEST_TOKEN_ADDRESS not set in environment");
  }

  if (!evmBridgeAddress) {
    throw new Error("EVM_BRIDGE_ADDRESS not set in environment");
  }

  if (!evmWormholeAddress) {
    throw new Error("EVM_WORMHOLE_ADDRESS not set in environment");
  }

  const evmProvider = new ethers.providers.JsonRpcProvider(evmRpcUrl);
  const evmWallet = new ethers.Wallet(evmPrivateKey, evmProvider);

  const solanaConnection = new Connection(solanaRpcUrl, "confirmed");
  const solanaPayer = loadSolanaKeypair();

  console.log(`EVM Address: ${evmWallet.address}`);
  console.log(`Solana Address: ${solanaPayer.publicKey.toString()}\n`);

  const bridgeABI = [
    "function sendTokensWithPayload(address token, uint256 amount, uint16 targetChain, bytes32 targetRecipient, uint32 batchId) external payable returns (uint64 sequence)",
    "function redeemTokensWithPayload(bytes memory encodedVaa) external",
    "event TokensSent(uint16 indexed targetChain, bytes32 indexed targetRecipient, uint256 amount, uint64 sequence)",
  ];

  const bridge = new ethers.Contract(evmBridgeAddress, bridgeABI, evmWallet);

  const erc20ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
  ];
  const token = new ethers.Contract(tokenAddress, erc20ABI, evmWallet);

  const decimals = await token.decimals();
  const symbol = await token.symbol();
  const balance = await token.balanceOf(evmWallet.address);

  console.log(`Token: ${symbol} (${tokenAddress})`);
  console.log(
    `Balance: ${ethers.utils.formatUnits(balance, decimals)} ${symbol}\n`
  );

  const amount = ethers.utils.parseUnits("1", decimals);
  const batchId = 0;

  if (balance.lt(amount)) {
    throw new Error(
      `Insufficient token balance. Have: ${ethers.utils.formatUnits(balance, decimals)}, need: ${ethers.utils.formatUnits(amount, decimals)}`
    );
  }

  const recipientBytes32 = ethers.utils.hexZeroPad(
    solanaPayer.publicKey.toBuffer(),
    32
  );

  console.log("Step 1: Sending tokens from EVM to Solana");
  console.log(`   Token: ${tokenAddress}`);
  console.log(`   Amount: ${ethers.utils.formatUnits(amount, decimals)} ${symbol}`);
  console.log(`   Target Chain: Solana (${WORMHOLE_CHAIN_IDS.SOLANA})`);
  console.log(`   Target Recipient: ${solanaPayer.publicKey.toString()}\n`);

  const allowance = await token.allowance(evmWallet.address, evmBridgeAddress);
  if (allowance.lt(amount)) {
    console.log("   Approving tokens...");
    const approveTx = await token.approve(
      evmBridgeAddress,
      ethers.constants.MaxUint256
    );
    await approveTx.wait();
    console.log("   Tokens approved\n");
  }

  const wormholeFee = await getWormholeFee(evmProvider, evmWormholeAddress);
  console.log(
    `   Wormhole fee: ${ethers.utils.formatEther(wormholeFee)} ETH\n`
  );

  console.log("Sending transaction...");

  try {
    const tx = await bridge.sendTokensWithPayload(
      tokenAddress,
      amount,
      WORMHOLE_CHAIN_IDS.SOLANA,
      recipientBytes32,
      batchId,
      { value: wormholeFee }
    );

    console.log(`   Transaction hash: ${tx.hash}`);
    console.log("   Waiting for confirmation...\n");

    const receipt = await tx.wait();
    const sequence = parseSequenceFromLogEth(receipt, evmWormholeAddress);

    console.log(`Transaction confirmed: ${receipt.transactionHash}`);
    console.log(`   Sequence: ${sequence}\n`);

    console.log("Step 2: Waiting for VAA from Wormhole guardians...");
    console.log("   This may take 1-2 minutes...\n");

    const emitterAddress = getEmitterAddressEth(evmBridgeAddress);
    console.log(`   Emitter Address: ${emitterAddress}`);

    const vaa = await waitForVAA(
      wormholeRpcUrl,
      evmChainId as ChainId,
      emitterAddress,
      BigInt(sequence.toString()),
      180000
    );

    console.log(`\nVAA received (${vaa.length} bytes)\n`);

    const parsedVaa = parseTokenTransferVaa(vaa);
    const isNative = parsedVaa.tokenChain === WORMHOLE_CHAIN_IDS.SOLANA;

    console.log("Step 3: Redeeming tokens on Solana");
    console.log(`   Token Chain: ${parsedVaa.tokenChain}`);
    console.log(
      `   Token Address: ${Buffer.from(parsedVaa.tokenAddress).toString("hex")}`
    );
    console.log(`   Is Native Token: ${isNative}\n`);

    const crossChainBridge = await import(
      "../../../../solana/ts/sdk/cross_chain_bridge/index.js"
    );

    let redeemInstruction;
    if (isNative) {
      redeemInstruction =
        await crossChainBridge.createRedeemNativeTransferWithPayloadInstruction(
          solanaConnection,
          bridgeProgramId,
          solanaPayer.publicKey,
          tokenBridgeProgramId,
          wormholeProgramId,
          vaa
        );
    } else {
      redeemInstruction =
        await crossChainBridge.createRedeemWrappedTransferWithPayloadInstruction(
          solanaConnection,
          bridgeProgramId,
          solanaPayer.publicKey,
          tokenBridgeProgramId,
          wormholeProgramId,
          vaa
        );
    }

    console.log("Sending redeem transaction...");

    const redeemTransaction = new Transaction().add(redeemInstruction);
    const redeemSignature = await sendAndConfirmTransaction(
      solanaConnection,
      redeemTransaction,
      [solanaPayer],
      { commitment: "confirmed" }
    );

    console.log(`\nTokens redeemed on Solana: ${redeemSignature}\n`);

    console.log("Cross-chain transfer completed successfully!");
    console.log(`   EVM TX: ${receipt.transactionHash}`);
    console.log(`   Solana Redeem TX: ${redeemSignature}`);
  } catch (error: any) {
    console.error("Transaction failed:", error);
    if (error.logs) {
      console.error("Logs:", error.logs);
    }
    throw error;
  }
}

testEvmToSolana().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
