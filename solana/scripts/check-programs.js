const { Connection, PublicKey } = require('@solana/web3.js');

const RPC_URL = 'http://localhost:8899';
const connection = new Connection(RPC_URL, 'confirmed');

const programs = [
  { name: 'MPL Token Metadata', address: 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s' },
  { name: 'Wormhole Core Bridge (mainnet)', address: 'worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth' },
  { name: 'Token Bridge (mainnet)', address: 'wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb' },
];

async function checkProgram(name, address) {
  try {
    const pubkey = new PublicKey(address);
    const accountInfo = await connection.getAccountInfo(pubkey);
    
    if (accountInfo) {
      console.log(`[OK] ${name}:`);
      console.log(`   Address: ${address}`);
      console.log(`   Owner: ${accountInfo.owner.toBase58()}`);
      console.log(`   Executable: ${accountInfo.executable}`);
      console.log(`   Data length: ${accountInfo.data.length} bytes`);
      console.log(`   Lamports: ${accountInfo.lamports}`);
      console.log('');
      return true;
    } else {
      console.log(`[ERROR] ${name}: NOT FOUND`);
      console.log(`   Address: ${address}`);
      console.log('');
      return false;
    }
  } catch (error) {
    console.log(`[ERROR] ${name}: ERROR - ${error.message}`);
    console.log(`   Address: ${address}`);
    console.log('');
    return false;
  }
}

async function main() {
  console.log(`Checking programs on ${RPC_URL}...\n`);
  
  const version = await connection.getVersion();
  console.log(`Solana version: ${version['solana-core']}\n`);
  
  let found = 0;
  for (const program of programs) {
    const exists = await checkProgram(program.name, program.address);
    if (exists) found++;
  }
  
  console.log(`\nSummary: ${found}/${programs.length} programs found`);
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
