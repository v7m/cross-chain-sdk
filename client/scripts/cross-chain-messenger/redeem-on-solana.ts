import { config as dotenvConfig } from "dotenv";

dotenvConfig();

async function main() {
  const { SolanaMessengerClient } = await import("../../src/cross-chain-messenger/solana-client.js");
  const { config } = await import("../../src/cross-chain-messenger/config.js");
  const { getEmitterAddressEth } = await import("@certusone/wormhole-sdk/lib/cjs/bridge/getEmitterAddress");

  const seq = process.argv[2] || process.env.REDEEM_SEQUENCE;
  if (!seq) {
    console.error("Usage: tsx scripts/cross-chain-messenger/redeem-on-solana.ts <sequence>");
    console.error("   or set REDEEM_SEQUENCE");
    process.exit(1);
  }

  const emitter = getEmitterAddressEth(config.evm.messengerAddress);
  const chainId = config.evm.chainId as number;

  console.log("Fetching VAA...");
  const baseUrl = config.wormhole.rpcUrl.replace("/v1", "") || "https://api.wormholescan.io";
  const url = `${baseUrl}/v1/signed_vaa/${chainId}/${emitter}/${seq}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("VAA not found");
  const data = (await response.json()) as { vaaBytes?: string };
  if (!data.vaaBytes) throw new Error("VAA not found");
  const vaaBytes = new Uint8Array(Buffer.from(data.vaaBytes, "base64"));

  const solana = new SolanaMessengerClient();
  console.log("Redeeming on Solana...");
  const sig = await solana.receiveMessage(vaaBytes);
  console.log(`\nSolana TX: ${sig}`);
  console.log(`   Wormhole Scan: https://wormholescan.io/#/tx/${chainId}/${emitter}/${seq}`);
  console.log(`   Solscan: https://solscan.io/tx/${sig}`);
  console.log(`\nMessage successfully received on Solana!`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
