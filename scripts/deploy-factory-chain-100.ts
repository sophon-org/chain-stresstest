import { formatEther, defineChain, createWalletClient, createPublicClient, http, getContract } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "fs";
import { join } from "path";

console.log("🚀 Starting Factory Chain 100 Deployment Stress Test");
console.log("=".repeat(60));

// Check for private key
if (!process.env.PRIVATE_KEY) {
  console.error("\n❌ Error: PRIVATE_KEY environment variable not set");
  console.error("   Please run: export PRIVATE_KEY='your_private_key_here'");
  process.exit(1);
}

// Define Sophon testnet chain
const sophonTestnet = defineChain({
  id: 531050204,
  name: "Sophon Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "Sophon",
    symbol: "SOPH",
  },
  rpcUrls: {
    default: {
      http: ["https://zksync-os-testnet-sophon.zksync.dev"],
    },
  },
  blockExplorers: {
    default: {
      name: "Explorer",
      url: "https://block-explorer-api.zksync-os-testnet-sophon.zksync.dev/",
    },
  },
});

// Create viem clients
const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const publicClient = createPublicClient({
  chain: sophonTestnet,
  transport: http(),
});

const walletClient = createWalletClient({
  account,
  chain: sophonTestnet,
  transport: http(),
});

console.log(`\n📍 Network: Sophon Testnet`);
console.log(`🔑 Deployer Address: ${account.address}`);

// Get deployer balance
const balance = await publicClient.getBalance({
  address: account.address,
});
console.log(`💰 Deployer Balance: ${formatEther(balance)} SOPH`);

// Get chain ID
const chainId = await publicClient.getChainId();
console.log(`⛓️  Chain ID: ${chainId}`);

console.log("\n" + "=".repeat(60));
console.log("⏳ Deploying Factory1 (which will deploy all 100 factories)...");
console.log("⚠️  WARNING: This may take a while and use significant gas!");
console.log("=".repeat(60));

// Load compiled contract
const artifactPath = join(process.cwd(), "artifacts/contracts/FactoryChain100.sol/Factory1.json");
const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));

const startTime = Date.now();

// Deploy Factory1
console.log("\n📤 Submitting deployment transaction...");
const hash = await walletClient.deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode as `0x${string}`,
  args: [],
});

console.log(`\n📝 Deployment Transaction Hash: ${hash}`);
console.log("⏳ Waiting for confirmation (this may take 30-60 seconds)...");

// Wait for transaction receipt
const receipt = await publicClient.waitForTransactionReceipt({ hash });

const endTime = Date.now();
const deploymentDuration = (endTime - startTime) / 1000;

if (!receipt.contractAddress) {
  throw new Error("Contract deployment failed - no contract address in receipt");
}

console.log("\n✅ Factory1 deployed successfully!");
console.log(`📋 Factory1 Address: ${receipt.contractAddress}`);
console.log(`⏱️  Total Deployment Time: ${deploymentDuration.toFixed(2)}s`);

// Wait a bit for the transaction to be fully processed
console.log("\n⏳ Waiting for transaction to be fully confirmed...");
await new Promise((resolve) => setTimeout(resolve, 3000));

console.log("\n" + "=".repeat(60));
console.log("🔍 Retrieving all deployed contract addresses...");
console.log("=".repeat(60));

try {
  // Get Factory1 contract instance
  const factory1 = getContract({
    address: receipt.contractAddress,
    abi: artifact.abi,
    client: { public: publicClient, wallet: walletClient },
  });

  // Get all addresses in the chain
  console.log("⏳ Fetching all 100 contract addresses (this may take a moment)...");
  const addresses = (await factory1.read.getAllAddresses([])) as readonly `0x${string}`[];

  console.log("\n📦 All 100 Factory Contracts Deployed:");
  console.log("-".repeat(60));
  
  // Show first 10
  for (let i = 0; i < 10; i++) {
    console.log(`   Factory${i + 1}: ${addresses[i]}`);
  }
  console.log("   ...");
  
  // Show last 10
  for (let i = 90; i < 100; i++) {
    console.log(`   Factory${i + 1}: ${addresses[i]}`);
  }
  console.log("-".repeat(60));

  // Verify a sample of contracts
  console.log("\n🔍 Verifying sample contracts...");
  console.log("-".repeat(60));

  const samplesToVerify = [1, 10, 25, 50, 75, 90, 100];

  for (const factoryNum of samplesToVerify) {
    try {
      const contractName = `Factory${factoryNum}`;
      const factoryArtifactPath = join(
        process.cwd(),
        `artifacts/contracts/FactoryChain100.sol/${contractName}.json`
      );
      const factoryArtifact = JSON.parse(readFileSync(factoryArtifactPath, "utf8"));

      const factory = getContract({
        address: addresses[factoryNum - 1],
        abi: factoryArtifact.abi,
        client: { public: publicClient },
      });

      const number = await factory.read.factoryNumber([]);

      console.log(`   ✓ ${contractName} (${addresses[factoryNum - 1]})`);
      console.log(`     - Factory Number: ${number}`);
    } catch {
      console.log(`   ✗ Factory${factoryNum} verification failed`);
    }
  }
  console.log("-".repeat(60));

  console.log("\n" + "=".repeat(60));
  console.log("📊 Transaction Statistics");
  console.log("=".repeat(60));
  console.log(`   Transaction Hash: ${hash}`);
  console.log(`   Block Number: ${receipt.blockNumber}`);
  console.log(`   Gas Used: ${receipt.gasUsed.toLocaleString()}`);
  console.log(
    `   Effective Gas Price: ${formatEther(receipt.effectiveGasPrice)} SOPH (${receipt.effectiveGasPrice.toString()} wei)`
  );
  console.log(
    `   Total Cost: ~${formatEther(receipt.gasUsed * receipt.effectiveGasPrice)} SOPH`
  );
  console.log(
    `   Status: ${receipt.status === "success" ? "✅ Success" : "❌ Failed"}`
  );

  console.log("\n" + "=".repeat(60));
  console.log("🎉 STRESS TEST COMPLETED SUCCESSFULLY!");
  console.log("=".repeat(60));
  console.log(`   ✅ 100 Factory Contracts deployed in a single transaction`);
  console.log(`   ⏱️  Duration: ${deploymentDuration.toFixed(2)}s`);
  console.log(`   📋 Factory1 Address: ${receipt.contractAddress}`);
  console.log(`   💰 Total Gas Used: ${receipt.gasUsed.toLocaleString()}`);
  console.log(`   📊 Gas per Factory: ~${Math.round(Number(receipt.gasUsed) / 100).toLocaleString()}`);
  console.log("=".repeat(60));
  
  console.log("\n💡 Tips:");
  console.log(`   - View events: bun run scripts/view-events.ts ${hash}`);
  console.log(`   - View in explorer: https://block-explorer-api.zksync-os-testnet-sophon.zksync.dev/tx/${hash}`);
  
} catch (error) {
  console.error("\n❌ Error during verification:", error);
  console.log("\n⚠️  Factory1 was deployed but verification failed.");
  console.log(`   You can still interact with Factory1 at: ${receipt.contractAddress}`);
}

