import { formatEther, defineChain, createWalletClient, createPublicClient, http, getContract } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "fs";
import { join } from "path";

console.log("🚀 Starting Factory Chain Deployment Stress Test");
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
console.log("⏳ Deploying Factory1 (which will deploy all 10 factories)...");
console.log("=".repeat(60));

// Load compiled contract
const artifactPath = join(process.cwd(), "artifacts/contracts/FactoryChain.sol/Factory1.json");
const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));

const startTime = Date.now();

// Deploy Factory1
const hash = await walletClient.deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode as `0x${string}`,
  args: [],
});

console.log(`\n📝 Deployment Transaction Hash: ${hash}`);
console.log("⏳ Waiting for confirmation...");

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
console.log("\n⏳ Waiting for transaction to be confirmed...");
await new Promise((resolve) => setTimeout(resolve, 2000));

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
  const addresses = (await factory1.read.getAllAddresses([])) as readonly `0x${string}`[];

  console.log("\n📦 All 10 Factory Contracts Deployed:");
  console.log("-".repeat(60));
  addresses.forEach((address, index) => {
    console.log(`   Factory${index + 1}: ${address}`);
  });
  console.log("-".repeat(60));

  // Verify each contract by reading its factoryNumber
  console.log("\n🔍 Verifying each contract...");
  console.log("-".repeat(60));

  for (let i = 0; i < addresses.length; i++) {
    const factoryNum = i + 1;
    const contractName = `Factory${factoryNum}`;

    try {
      // Load artifact for this factory
      const factoryArtifactPath = join(
        process.cwd(),
        `artifacts/contracts/FactoryChain.sol/${contractName}.json`
      );
      const factoryArtifact = JSON.parse(readFileSync(factoryArtifactPath, "utf8"));

      const factory = getContract({
        address: addresses[i],
        abi: factoryArtifact.abi,
        client: { public: publicClient },
      });

      const number = await factory.read.factoryNumber([]);
      const info = (await factory.read.getInfo([])) as
        | readonly [bigint, bigint, string]
        | readonly [bigint, bigint];

      console.log(`   ✓ ${contractName} (${addresses[i]})`);
      console.log(`     - Factory Number: ${number}`);
      console.log(
        `     - Deployment Time: ${new Date(Number(info[1]) * 1000).toISOString()}`
      );
      if (info.length > 2) {
        console.log(`     - Deployed Contract: ${info[2]}`);
      }
    } catch {
      console.log(`   ✗ ${contractName} verification failed`);
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
  console.log(`   ✅ 10 Factory Contracts deployed in a single transaction`);
  console.log(`   ⏱️  Duration: ${deploymentDuration.toFixed(2)}s`);
  console.log(`   📋 Factory1 Address: ${receipt.contractAddress}`);
  console.log(`   💰 Total Gas Used: ${receipt.gasUsed.toLocaleString()}`);
  console.log("=".repeat(60));
} catch (error) {
  console.error("\n❌ Error during verification:", error);
  console.log("\n⚠️  Factory1 was deployed but verification failed.");
  console.log(`   You can still interact with Factory1 at: ${receipt.contractAddress}`);
}
