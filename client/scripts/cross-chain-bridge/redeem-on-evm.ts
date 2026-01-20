import { ethers } from "ethers";
import { PublicKey } from "@solana/web3.js";
import { config as dotenvConfig } from "dotenv";

dotenvConfig();

const WORMHOLE_CHAIN_IDS = {
  SOLANA: 1,
  ETHEREUM: 2,
  BASE: 30,
} as const;

function getTokenBridgeEmitterAddress(tokenBridgeProgramId: PublicKey): string {
  const [emitterPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("emitter")],
    tokenBridgeProgramId
  );
  return emitterPda.toBuffer().toString("hex").padStart(64, "0");
}

async function fetchVAAFromWormhole(
  emitterChain: number,
  emitterAddress: string,
  sequence: string,
  timeout: number = 180000
): Promise<Uint8Array> {
  const startTime = Date.now();
  const baseUrl = "https://api.wormholescan.io";

  console.log(`Fetching VAA for:`);
  console.log(`   Emitter Chain: ${emitterChain}`);
  console.log(`   Emitter Address: ${emitterAddress}`);
  console.log(`   Sequence: ${sequence}\n`);

  while (Date.now() - startTime < timeout) {
    try {
      const url = `${baseUrl}/v1/signed_vaa/${emitterChain}/${emitterAddress}/${sequence}`;
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        if (data.vaaBytes) {
          const vaaBytes = Buffer.from(data.vaaBytes, "base64");
          return new Uint8Array(vaaBytes);
        }
      }
    } catch {
      // API not ready yet, retry
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`   Waiting for VAA... (${elapsed}s elapsed)`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  throw new Error(`Timeout waiting for VAA after ${timeout}ms`);
}

function parseVAAHeader(vaa: Uint8Array): {
  version: number;
  guardianSetIndex: number;
  signaturesCount: number;
  timestamp: number;
  nonce: number;
  emitterChain: number;
  emitterAddress: string;
  sequence: bigint;
  consistencyLevel: number;
  payloadStart: number;
} {
  let offset = 0;

  const version = vaa[offset];
  offset += 1;

  const guardianSetIndex = (vaa[offset] << 24) | (vaa[offset + 1] << 16) | (vaa[offset + 2] << 8) | vaa[offset + 3];
  offset += 4;

  const signaturesCount = vaa[offset];
  offset += 1;

  offset += signaturesCount * 66;

  const timestamp = (vaa[offset] << 24) | (vaa[offset + 1] << 16) | (vaa[offset + 2] << 8) | vaa[offset + 3];
  offset += 4;

  const nonce = (vaa[offset] << 24) | (vaa[offset + 1] << 16) | (vaa[offset + 2] << 8) | vaa[offset + 3];
  offset += 4;

  const emitterChain = (vaa[offset] << 8) | vaa[offset + 1];
  offset += 2;

  const emitterAddress = Buffer.from(vaa.slice(offset, offset + 32)).toString("hex");
  offset += 32;

  const sequence = Buffer.from(vaa.slice(offset, offset + 8)).readBigUInt64BE(0);
  offset += 8;

  const consistencyLevel = vaa[offset];
  offset += 1;

  return {
    version,
    guardianSetIndex,
    signaturesCount,
    timestamp,
    nonce,
    emitterChain,
    emitterAddress,
    sequence,
    consistencyLevel,
    payloadStart: offset,
  };
}

async function redeemOnEvm() {
  console.log("Starting EVM Redeem for Solana -> EVM transfer\n");

  const sequence = process.argv[2] || process.env.REDEEM_SEQUENCE;
  if (!sequence) {
    console.error("Usage: tsx scripts/cross-chain-bridge/redeem-on-evm.ts <sequence>");
    console.error("   or set REDEEM_SEQUENCE env variable");
    console.error("\nExample: npm run bridge:redeem-evm -- 1362737");
    process.exit(1);
  }

  const evmRpcUrl = process.env.EVM_RPC_URL || "https://mainnet.base.org";
  const evmPrivateKey = process.env.EVM_PRIVATE_KEY || "";
  const evmBridgeAddress = process.env.EVM_BRIDGE_ADDRESS || "";

  const tokenBridgeProgramId = new PublicKey(
    process.env.SOLANA_TOKEN_BRIDGE_PROGRAM_ID ||
      "wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb"
  );

  if (!evmBridgeAddress) {
    throw new Error("EVM_BRIDGE_ADDRESS not set in environment");
  }

  if (!evmPrivateKey) {
    throw new Error("EVM_PRIVATE_KEY not set in environment");
  }

  const evmProvider = new ethers.providers.JsonRpcProvider(evmRpcUrl);
  const evmWallet = new ethers.Wallet(evmPrivateKey, evmProvider);

  console.log(`EVM Address: ${evmWallet.address}`);
  console.log(`Bridge Contract: ${evmBridgeAddress}`);
  console.log(`Sequence: ${sequence}\n`);

  const emitterAddress = getTokenBridgeEmitterAddress(tokenBridgeProgramId);
  console.log(`Solana Token Bridge Emitter: ${emitterAddress}\n`);

  console.log("Step 1: Fetching VAA from Wormhole guardians...\n");

  const vaa = await fetchVAAFromWormhole(
    WORMHOLE_CHAIN_IDS.SOLANA,
    emitterAddress,
    sequence,
    180000
  );

  console.log(`\nVAA received (${vaa.length} bytes)\n`);

  try {
    const header = parseVAAHeader(vaa);
    console.log("VAA Details:");
    console.log(`   Version: ${header.version}`);
    console.log(`   Guardian Set: ${header.guardianSetIndex}`);
    console.log(`   Signatures: ${header.signaturesCount}`);
    console.log(`   Emitter Chain: ${header.emitterChain}`);
    console.log(`   Sequence: ${header.sequence}`);
    console.log(`   Timestamp: ${new Date(header.timestamp * 1000).toISOString()}\n`);
  } catch (e) {
    console.log("   (Could not parse VAA header)\n");
  }

  console.log("Step 2: Redeeming tokens on EVM...\n");

  const bridgeABI = [
    "function redeemTokensWithPayload(bytes memory encodedVaa) external",
    "event TokensRedeemed(uint16 indexed sourceChain, bytes32 indexed sourceEmitter, address indexed recipient, address token, uint256 amount)",
  ];

  const bridge = new ethers.Contract(evmBridgeAddress, bridgeABI, evmWallet);

  try {
    console.log("Sending redeem transaction...");

    const tx = await bridge.redeemTokensWithPayload(ethers.utils.hexlify(vaa));
    console.log(`   Transaction hash: ${tx.hash}`);
    console.log("   Waiting for confirmation...\n");

    const receipt = await tx.wait();

    console.log("Redeem successful!");
    console.log(`   Transaction: ${receipt.transactionHash}`);
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed.toString()}\n`);

    for (const log of receipt.logs) {
      try {
        const parsed = bridge.interface.parseLog(log);
        if (parsed.name === "TokensRedeemed") {
          console.log("TokensRedeemed Event:");
          console.log(`   Source Chain: ${parsed.args.sourceChain}`);
          console.log(`   Recipient: ${parsed.args.recipient}`);
          console.log(`   Token: ${parsed.args.token}`);
          console.log(`   Amount: ${parsed.args.amount.toString()}`);
        }
      } catch {
        // Not our event
      }
    }

    console.log("\nCross-chain transfer completed!");
    console.log(
      `   View on BaseScan: https://basescan.org/tx/${receipt.transactionHash}`
    );
  } catch (error: any) {
    console.error("Redeem failed:", error.message);
    if (error.reason) {
      console.error("Reason:", error.reason);
    }
    if (error.error?.message) {
      console.error("Details:", error.error.message);
    }
    throw error;
  }
}

redeemOnEvm().catch((error) => {
  console.error("Redeem failed:", error);
  process.exit(1);
});
