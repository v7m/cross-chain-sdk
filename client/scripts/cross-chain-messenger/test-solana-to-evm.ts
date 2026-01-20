import { config as dotenvConfig } from "dotenv";

dotenvConfig();

async function main() {
  const { EvmMessengerClient } = await import("../../src/cross-chain-messenger/evm-client.js");
  const { SolanaMessengerClient } = await import("../../src/cross-chain-messenger/solana-client.js");

  console.log("Solana -> EVM message test\n");

  const payload =
    process.env.MESSENGER_PAYLOAD || "Hello from Solana to EVM via Wormhole!";

  const solana = new SolanaMessengerClient();
  const evm = new EvmMessengerClient();

  console.log(`Payload: ${payload}`);
  console.log(`Solana sender: ${solana.getAddress().toString()}`);
  console.log(`EVM receiver: ${evm.getAddress()}\n`);

  console.log("Step 1: Sending message from Solana...");
  const { sequence, signature } = await solana.sendMessage(payload);
  console.log(`\nSolana TX: ${signature}`);
  console.log(`   Solscan: https://solscan.io/tx/${signature}`);

  const emitter = await solana.getEmitterAddress();
  console.log(`   Wormhole Scan: https://wormholescan.io/#/tx/1/${emitter}/${sequence}\n`);

  console.log("Step 2: Waiting for VAA (1–2 min)...");
  const vaa = await solana.waitForVAA(
    1 as any,
    emitter,
    sequence,
    180_000
  );
  console.log(`VAA received (${vaa.length} bytes)\n`);

  console.log("Step 3: Receiving on EVM...");
  const txHash = await evm.receiveMessage(vaa);
  console.log(`\nEVM TX: ${txHash}`);
  console.log(`   BaseScan: https://basescan.org/tx/${txHash}`);

  console.log(`\nDone! Message successfully sent from Solana to EVM.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
