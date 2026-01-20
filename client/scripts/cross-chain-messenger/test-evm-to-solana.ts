import { config as dotenvConfig } from "dotenv";

dotenvConfig();

async function main() {
  const { EvmMessengerClient } = await import("../../src/cross-chain-messenger/evm-client.js");
  const { SolanaMessengerClient } = await import("../../src/cross-chain-messenger/solana-client.js");
  const { config } = await import("../../src/cross-chain-messenger/config.js");

  console.log("EVM -> Solana message test\n");

  const payload =
    process.env.MESSENGER_PAYLOAD || "Hello from EVM to Solana via Wormhole!";

  const evm = new EvmMessengerClient();
  const solana = new SolanaMessengerClient();

  console.log(`Payload: ${payload}`);
  console.log(`EVM sender: ${evm.getAddress()}`);
  console.log(`Solana receiver: ${solana.getAddress().toString()}\n`);

  console.log("Step 1: Sending message from EVM...");
  const { sequence, txHash } = await evm.sendMessage(payload);
  console.log(`\nEVM TX: ${txHash}`);
  console.log(`   BaseScan: https://basescan.org/tx/${txHash}`);

  const { getEmitterAddressEth } = await import("@certusone/wormhole-sdk/lib/cjs/bridge/getEmitterAddress");
  const emitter = getEmitterAddressEth(config.evm.messengerAddress);
  console.log(`   Wormhole Scan: https://wormholescan.io/#/tx/${config.evm.chainId}/${emitter}/${sequence}\n`);

  console.log("Step 2: Waiting for VAA...");
  const vaa = await evm.waitForVAA(
    config.evm.chainId as any,
    emitter,
    sequence,
    180_000
  );
  console.log(`VAA received (${vaa.length} bytes)\n`);

  console.log("Step 3: Receiving on Solana...");
  const sig = await solana.receiveMessage(vaa);
  console.log(`\nSolana TX: ${sig}`);
  console.log(`   Solscan: https://solscan.io/tx/${sig}`);

  console.log(`\nDone! Message successfully sent from EVM to Solana.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
