import { config as dotenvConfig } from "dotenv";
import { PublicKey } from "@solana/web3.js";

dotenvConfig();

function deriveEmitterPda(programId: PublicKey): string {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("emitter")],
    programId
  );
  return Buffer.from(pda.toBytes()).toString("hex");
}

async function main() {
  const { EvmMessengerClient } = await import("../../src/cross-chain-messenger/evm-client.js");
  const { config } = await import("../../src/cross-chain-messenger/config.js");

  const seq = process.argv[2] || process.env.REDEEM_SEQUENCE;
  if (!seq) {
    console.error("Usage: tsx scripts/cross-chain-messenger/redeem-on-evm.ts <sequence>");
    console.error("   or set REDEEM_SEQUENCE");
    process.exit(1);
  }

  const programId = config.solana.messengerProgramId;
  const emitter = deriveEmitterPda(programId);

  console.log("Fetching VAA...");
  const baseUrl = config.wormhole.rpcUrl.replace("/v1", "") || "https://api.wormholescan.io";
  const url = `${baseUrl}/v1/signed_vaa/1/${emitter}/${seq}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("VAA not found");
  const data = (await response.json()) as { vaaBytes?: string };
  if (!data.vaaBytes) throw new Error("VAA not found");
  const vaaBytes = new Uint8Array(Buffer.from(data.vaaBytes, "base64"));

  const evm = new EvmMessengerClient();
  console.log("Redeeming on EVM...");
  const tx = await evm.receiveMessage(vaaBytes);
  console.log(`\nEVM TX: ${tx}`);
  console.log(`   Wormhole Scan: https://wormholescan.io/#/tx/1/${emitter}/${seq}`);
  console.log(`   BaseScan: https://basescan.org/tx/${tx}`);
  console.log(`\nMessage successfully received on EVM!`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
