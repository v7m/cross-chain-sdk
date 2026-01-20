import { ethers } from "ethers";
import { config as dotenvConfig } from "dotenv";

dotenvConfig();

async function checkBalance() {
  const rpcUrl = process.env.EVM_RPC_URL || "https://mainnet.base.org";
  const privateKey = process.env.EVM_PRIVATE_KEY || "";

  if (!privateKey) {
    console.error("EVM_PRIVATE_KEY not set");
    process.exit(1);
  }

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const balance = await provider.getBalance(wallet.address);
  const wormholeFee = await (async () => {
    try {
      const wormholeAddress = process.env.EVM_WORMHOLE_ADDRESS || "";
      if (!wormholeAddress) return ethers.BigNumber.from(0);
      const wormholeABI = ["function messageFee() external view returns (uint256)"];
      const wormhole = new ethers.Contract(wormholeAddress, wormholeABI, provider);
      return await wormhole.messageFee();
    } catch {
      return ethers.BigNumber.from(0);
    }
  })();

  console.log(`\nWallet: ${wallet.address}`);
  console.log(`Balance: ${ethers.utils.formatEther(balance)} ETH`);
  console.log(`Wormhole Fee: ${ethers.utils.formatEther(wormholeFee)} ETH`);
  
  const gasPrice = await provider.getGasPrice();
  const estimatedGas = ethers.BigNumber.from(200000);
  const estimatedGasCost = estimatedGas.mul(gasPrice);
  const totalNeeded = wormholeFee.add(estimatedGasCost);
  
  console.log(`Estimated Gas Cost: ${ethers.utils.formatEther(estimatedGasCost)} ETH`);
  console.log(`Total Needed: ${ethers.utils.formatEther(totalNeeded)} ETH`);
  
  if (balance.lt(totalNeeded)) {
    console.log(`\n⚠️  Insufficient balance! Need ${ethers.utils.formatEther(totalNeeded.sub(balance))} more ETH`);
  } else {
    console.log(`\n✅ Balance sufficient`);
  }
  
  console.log(`\nView on BaseScan: https://basescan.org/address/${wallet.address}\n`);
}

checkBalance().catch((e) => {
  console.error(e);
  process.exit(1);
});
