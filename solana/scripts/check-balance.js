const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

const RPC_URL = process.env.SOLANA_RPC_URL || 'http://localhost:8899';
const WALLET_PATH = process.env.SOLANA_KEYPAIR_PATH || path.join(process.env.HOME, '.config/solana/id.json');

async function main() {
  const connection = new Connection(RPC_URL, 'confirmed');
  
  console.log(`RPC URL: ${RPC_URL}`);
  console.log(`Wallet: ${WALLET_PATH}\n`);

  try {
    const version = await connection.getVersion();
    console.log(`Solana version: ${version['solana-core']}\n`);
  } catch (error) {
    console.error(`Error connecting to RPC: ${error.message}`);
    process.exit(1);
  }

  try {
    const keypairData = JSON.parse(fs.readFileSync(WALLET_PATH, 'utf8'));
    const keypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
    const publicKey = keypair.publicKey;

    console.log(`Public Key: ${publicKey.toBase58()}`);

    const balance = await connection.getBalance(publicKey);
    const solBalance = balance / 1e9;

    console.log(`Balance: ${solBalance} SOL (${balance} lamports)`);

    if (solBalance < 1) {
      console.log('\nWarning: Low balance! You may need to airdrop SOL:');
      console.log(`   curl -X POST ${RPC_URL} -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"requestAirdrop","params":["${publicKey.toBase58()}",2000000000]}'`);
    }

    process.exit(0);
  } catch (error) {
    console.error(`Error reading wallet: ${error.message}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
