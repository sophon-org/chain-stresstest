import {
  createWalletClient,
  createPublicClient,
  http,
  defineChain,
  formatEther,
  formatUnits,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "fs";
import { join } from "path";

// Mock USDC on Sophon Testnet
// https://explorer.testnet.os.sophon.com/address/0x633BC05314E882B0d83aEc3A55ddeF2aEC37363A
const MOCK_USDC_ADDRESS = "0x633BC05314E882B0d83aEc3A55ddeF2aEC37363A" as const;

// Minimal ERC20 ABI for transfer, balance, and mint (for mock tokens)
const ERC20_ABI = [
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "decimals",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    name: "symbol",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    name: "mint",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

console.log("📊 SINGLE TRANSACTION LATENCY TEST");
console.log("=".repeat(70));

if (!process.env.PRIVATE_KEY) {
  console.error("❌ Error: PRIVATE_KEY environment variable not set");
  process.exit(1);
}

// Parse command line arguments
const FAST_MODE = process.argv.includes("--fast");
const validTypes = ["all", "transfer", "deploy", "call"];
// Get TX_TYPE from args, skipping --fast flag
const TX_TYPE = process.argv.slice(2).find(arg => !arg.startsWith("--")) || "all";

if (!validTypes.includes(TX_TYPE)) {
  console.error("❌ Invalid transaction type. Must be one of:");
  console.error("   - all      : Run all latency tests (default)");
  console.error("   - transfer : Mock USDC ERC20 transfer");
  console.error("   - deploy   : Counter contract deployment");
  console.error("   - call     : Counter contract function call");
  console.error("");
  console.error("Options:");
  console.error("   --fast    : Enable aggressive optimizations (lower polling, higher gas)");
  console.error("");
  console.error("Usage: bun run scripts/single-tx-latency.ts [type] [--fast]");
  console.error("");
  console.error("Example: bun run scripts/single-tx-latency.ts transfer --fast");
  process.exit(1);
}

// Define Sophon testnet
const sophonTestnet = defineChain({
  id: 531050204,
  name: "Sophon Testnet",
  nativeCurrency: { decimals: 18, name: "Sophon", symbol: "SOPH" },
  rpcUrls: {
    default: { http: ["https://zksync-os-testnet-sophon.zksync.dev"] },
  },
});

// Polling interval optimized for 200ms block times
// Fast mode: 25ms polling (aggressive, may hit rate limits)
// Normal mode: 100ms polling (safe default)
const POLLING_INTERVAL = FAST_MODE ? 25 : 100;

// Gas multiplier for priority (1.0 = normal, 1.5 = 50% higher for priority)
const GAS_PRICE_MULTIPLIER = FAST_MODE ? 1.5 : 1.0;

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const publicClient = createPublicClient({
  chain: sophonTestnet,
  transport: http(undefined, {
    retryCount: FAST_MODE ? 1 : 3,
    retryDelay: FAST_MODE ? 100 : 500,
    timeout: FAST_MODE ? 10_000 : 30_000,
  }),
  pollingInterval: POLLING_INTERVAL,
  batch: {
    multicall: true, // Batch multiple calls into one request
  },
});
const walletClient = createWalletClient({
  account,
  chain: sophonTestnet,
  transport: http(undefined, {
    retryCount: FAST_MODE ? 1 : 3,
    retryDelay: FAST_MODE ? 100 : 500,
    timeout: FAST_MODE ? 10_000 : 30_000,
  }),
});

// Load Counter contract artifact
const counterArtifactPath = join(
  process.cwd(),
  "artifacts/contracts/Counter.sol/Counter.json"
);
const counterArtifact = JSON.parse(readFileSync(counterArtifactPath, "utf8"));

interface LatencyResult {
  type: string;
  txHash: string;
  submissionLatency: number;
  confirmationLatency: number;
  totalLatency: number;
  blockNumber: bigint;
  blocksWaited: number;
  gasUsed: bigint;
  status: string;
  contractAddress?: string;
}

const results: LatencyResult[] = [];

async function warmupRpc(): Promise<void> {
  console.log("\n🔄 Warming up RPC connection...");
  const warmupStart = performance.now();
  await Promise.all([
    publicClient.getBlockNumber(),
    publicClient.getGasPrice(),
    publicClient.getChainId(),
    publicClient.getBlock({ blockTag: "latest" }),
  ]);
  const warmupTime = performance.now() - warmupStart;
  console.log(`   Warmup complete in ${warmupTime.toFixed(0)}ms`);
}

async function measureTransferLatency(): Promise<LatencyResult> {
  console.log("\n" + "-".repeat(70));
  console.log("📤 Testing: Mock USDC ERC20 Transfer (1 USDC to self)");
  console.log("-".repeat(70));

  // Get token info
  const [decimals, symbol, balance] = await Promise.all([
    publicClient.readContract({
      address: MOCK_USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: "decimals",
    }),
    publicClient.readContract({
      address: MOCK_USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: "symbol",
    }),
    publicClient.readContract({
      address: MOCK_USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account.address],
    }),
  ]);

  const transferAmount = parseUnits("1", decimals); // 1 USDC

  console.log(`   Token: ${symbol} at ${MOCK_USDC_ADDRESS}`);
  console.log(`   Balance: ${formatUnits(balance, decimals)} ${symbol}`);
  console.log(`   Transfer Amount: 1 ${symbol}`);

  if (balance < transferAmount) {
    console.log(`\n   ⚠️  Insufficient ${symbol} balance, attempting to mint...`);
    try {
      const mintAmount = parseUnits("1000", decimals); // Mint 1000 tokens
      const mintHash = await walletClient.writeContract({
        address: MOCK_USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "mint",
        args: [account.address, mintAmount],
      });
      console.log(`   Minting ${formatUnits(mintAmount, decimals)} ${symbol}...`);
      await publicClient.waitForTransactionReceipt({ hash: mintHash, timeout: 60_000 });
      console.log(`   ✅ Minted successfully!`);
    } catch (mintError: any) {
      console.error(`\n   ❌ Could not mint ${symbol}: ${mintError.message?.slice(0, 100)}`);
      console.error(`   Get test tokens from: https://explorer.testnet.os.sophon.com/address/${MOCK_USDC_ADDRESS}`);
      throw new Error(`Insufficient ${symbol} balance and mint failed`);
    }
  }

  // Get preflight info in parallel for speed
  const [blockNumber, baseGasPrice] = await Promise.all([
    publicClient.getBlockNumber(),
    publicClient.getGasPrice(),
  ]);

  // Apply gas multiplier for fast mode
  const gasPrice = BigInt(Math.floor(Number(baseGasPrice) * GAS_PRICE_MULTIPLIER));

  console.log(`   Pre-flight block: #${blockNumber}`);
  console.log(`   Gas price: ${gasPrice} wei${FAST_MODE ? " (boosted)" : ""}`);

  // === TIMING: Transaction Submission ===
  const submitStart = performance.now();

  const txHash = await walletClient.writeContract({
    address: MOCK_USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [account.address, transferAmount],
    gasPrice: FAST_MODE ? gasPrice : undefined,
  });

  const submitEnd = performance.now();
  const submissionLatency = submitEnd - submitStart;

  console.log(`   TX Hash: ${txHash}`);
  console.log(`   ⏱️  Submission Latency: ${submissionLatency.toFixed(2)}ms`);

  // === TIMING: Transaction Confirmation ===
  const confirmStart = performance.now();

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    timeout: 60_000,
  });

  const confirmEnd = performance.now();
  const confirmationLatency = confirmEnd - confirmStart;
  const totalLatency = confirmEnd - submitStart;

  const result: LatencyResult = {
    type: "ERC20",
    txHash,
    submissionLatency,
    confirmationLatency,
    totalLatency,
    blockNumber: receipt.blockNumber,
    blocksWaited: Number(receipt.blockNumber - blockNumber),
    gasUsed: receipt.gasUsed,
    status: receipt.status,
  };

  printLatencyBreakdown(result);
  return result;
}

async function measureDeployLatency(): Promise<LatencyResult> {
  console.log("\n" + "-".repeat(70));
  console.log("📤 Testing: Counter Contract Deployment");
  console.log("-".repeat(70));

  // Get preflight info in parallel for speed
  const [blockNumber, baseGasPrice] = await Promise.all([
    publicClient.getBlockNumber(),
    publicClient.getGasPrice(),
  ]);

  const gasPrice = BigInt(Math.floor(Number(baseGasPrice) * GAS_PRICE_MULTIPLIER));

  console.log(`   Pre-flight block: #${blockNumber}`);
  console.log(`   Bytecode size: ${(counterArtifact.bytecode.length / 2 - 1).toLocaleString()} bytes`);
  console.log(`   Gas price: ${gasPrice} wei${FAST_MODE ? " (boosted)" : ""}`);

  // === TIMING: Deployment Submission ===
  const submitStart = performance.now();

  const txHash = await walletClient.deployContract({
    abi: counterArtifact.abi,
    bytecode: counterArtifact.bytecode as `0x${string}`,
    args: [],
    gasPrice: FAST_MODE ? gasPrice : undefined,
  });

  const submitEnd = performance.now();
  const submissionLatency = submitEnd - submitStart;

  console.log(`   TX Hash: ${txHash}`);
  console.log(`   ⏱️  Submission Latency: ${submissionLatency.toFixed(2)}ms`);

  // === TIMING: Deployment Confirmation ===
  const confirmStart = performance.now();

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    timeout: 60_000,
  });

  const confirmEnd = performance.now();
  const confirmationLatency = confirmEnd - confirmStart;
  const totalLatency = confirmEnd - submitStart;

  const result: LatencyResult = {
    type: "Deploy",
    txHash,
    submissionLatency,
    confirmationLatency,
    totalLatency,
    blockNumber: receipt.blockNumber,
    blocksWaited: Number(receipt.blockNumber - blockNumber),
    gasUsed: receipt.gasUsed,
    status: receipt.status,
    contractAddress: receipt.contractAddress!,
  };

  printLatencyBreakdown(result);
  console.log(`   Contract: ${result.contractAddress}`);
  return result;
}

async function measureCallLatency(): Promise<LatencyResult> {
  console.log("\n" + "-".repeat(70));
  console.log("📤 Testing: Counter Contract Function Call (inc)");
  console.log("-".repeat(70));

  // First deploy a Counter contract (with gas boost if fast mode)
  console.log("   Deploying Counter contract...");
  const baseGasPrice = await publicClient.getGasPrice();
  const gasPrice = BigInt(Math.floor(Number(baseGasPrice) * GAS_PRICE_MULTIPLIER));

  const deployHash = await walletClient.deployContract({
    abi: counterArtifact.abi,
    bytecode: counterArtifact.bytecode as `0x${string}`,
    args: [],
    gasPrice: FAST_MODE ? gasPrice : undefined,
  });

  const deployReceipt = await publicClient.waitForTransactionReceipt({
    hash: deployHash,
    timeout: 60_000,
  });

  const contractAddress = deployReceipt.contractAddress!;
  console.log(`   Contract deployed at: ${contractAddress}`);

  // Get preflight block number (gas price already fetched above)
  const blockNumber = await publicClient.getBlockNumber();

  console.log(`   Pre-flight block: #${blockNumber}`);
  console.log(`   Gas price: ${gasPrice} wei${FAST_MODE ? " (boosted)" : ""}`);

  // === TIMING: Function Call Submission ===
  const submitStart = performance.now();

  const txHash = await walletClient.writeContract({
    address: contractAddress,
    abi: counterArtifact.abi,
    functionName: "inc",
    args: [],
    gasPrice: FAST_MODE ? gasPrice : undefined,
  });

  const submitEnd = performance.now();
  const submissionLatency = submitEnd - submitStart;

  console.log(`   TX Hash: ${txHash}`);
  console.log(`   ⏱️  Submission Latency: ${submissionLatency.toFixed(2)}ms`);

  // === TIMING: Function Call Confirmation ===
  const confirmStart = performance.now();

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    timeout: 60_000,
  });

  const confirmEnd = performance.now();
  const confirmationLatency = confirmEnd - confirmStart;
  const totalLatency = confirmEnd - submitStart;

  // Verify state change
  const counterValue = await publicClient.readContract({
    address: contractAddress,
    abi: counterArtifact.abi,
    functionName: "x",
    args: [],
  });

  const result: LatencyResult = {
    type: "Call",
    txHash,
    submissionLatency,
    confirmationLatency,
    totalLatency,
    blockNumber: receipt.blockNumber,
    blocksWaited: Number(receipt.blockNumber - blockNumber),
    gasUsed: receipt.gasUsed,
    status: receipt.status,
    contractAddress,
  };

  printLatencyBreakdown(result);
  console.log(`   Counter Value: ${counterValue}`);
  return result;
}

function printLatencyBreakdown(result: LatencyResult): void {
  console.log(`\n   📊 LATENCY BREAKDOWN:`);
  console.log(`   ├─ Submission:    ${result.submissionLatency.toFixed(2)}ms`);
  console.log(`   ├─ Confirmation:  ${result.confirmationLatency.toFixed(2)}ms`);
  console.log(`   └─ Total E2E:     ${result.totalLatency.toFixed(2)}ms (${(result.totalLatency / 1000).toFixed(3)}s)`);
  console.log(`\n   📦 TRANSACTION DETAILS:`);
  console.log(`   ├─ Status: ${result.status}`);
  console.log(`   ├─ Block: #${result.blockNumber}`);
  console.log(`   ├─ Gas Used: ${result.gasUsed}`);
  console.log(`   └─ Blocks waited: ${result.blocksWaited}`);
}

function printSummary(results: LatencyResult[]): void {
  console.log("\n" + "=".repeat(70));
  console.log("📊 LATENCY TEST SUMMARY");
  console.log("=".repeat(70));

  const avgSubmission = results.reduce((sum, r) => sum + r.submissionLatency, 0) / results.length;
  const avgConfirmation = results.reduce((sum, r) => sum + r.confirmationLatency, 0) / results.length;
  const avgTotal = results.reduce((sum, r) => sum + r.totalLatency, 0) / results.length;

  console.log(`\n   Tests Run: ${results.length}`);
  console.log(`   All Successful: ${results.every(r => r.status === "success") ? "✅" : "❌"}`);

  console.log(`\n   ⏱️  AVERAGE LATENCIES:`);
  console.log(`   ├─ Submission:    ${avgSubmission.toFixed(2)}ms`);
  console.log(`   ├─ Confirmation:  ${avgConfirmation.toFixed(2)}ms`);
  console.log(`   └─ Total E2E:     ${avgTotal.toFixed(2)}ms (${(avgTotal / 1000).toFixed(3)}s)`);

  console.log(`\n   📋 INDIVIDUAL RESULTS:`);
  console.log(`   ${"Type".padEnd(10)} ${"Submit".padStart(10)} ${"Confirm".padStart(10)} ${"Total".padStart(12)} ${"Blocks".padStart(8)}`);
  console.log(`   ${"-".repeat(52)}`);
  for (const r of results) {
    console.log(
      `   ${r.type.padEnd(10)} ${r.submissionLatency.toFixed(0).padStart(8)}ms ${r.confirmationLatency.toFixed(0).padStart(8)}ms ${r.totalLatency.toFixed(0).padStart(10)}ms ${r.blocksWaited.toString().padStart(8)}`
    );
  }
}

async function main() {
  console.log(`\n📊 Configuration:`);
  console.log(`   Test Type: ${TX_TYPE}`);
  console.log(`   Fast Mode: ${FAST_MODE ? "✅ ENABLED" : "❌ disabled (use --fast to enable)"}`);
  console.log(`   Account: ${account.address}`);
  console.log(`   Polling Interval: ${POLLING_INTERVAL}ms${FAST_MODE ? " (aggressive)" : ""}`);
  if (FAST_MODE) {
    console.log(`   Gas Price Boost: ${((GAS_PRICE_MULTIPLIER - 1) * 100).toFixed(0)}% higher`);
  }

  // Check RPC availability
  console.log(`\n🔍 Checking RPC availability...`);
  let balance: bigint;
  let nonce: number;

  try {
    balance = await publicClient.getBalance({ address: account.address });
    nonce = await publicClient.getTransactionCount({ address: account.address });
  } catch (error: any) {
    console.error(`\n❌ RPC Error: ${error.message}`);
    console.error(`\n⚠️  Possible issues:`);
    console.error(`   - RPC endpoint is down or overloaded`);
    console.error(`   - Network connectivity issues`);
    console.error(`   - Try again in a few moments`);
    process.exit(1);
  }

  console.log(`   Balance: ${formatEther(balance)} SOPH`);
  console.log(`   Nonce: ${nonce}`);

  // Warmup RPC connection
  await warmupRpc();

  console.log("\n" + "=".repeat(70));
  console.log("🔥 STARTING LATENCY TESTS...");
  console.log("=".repeat(70));

  const startTime = Date.now();

  // Run selected tests
  if (TX_TYPE === "all" || TX_TYPE === "transfer") {
    results.push(await measureTransferLatency());
  }

  if (TX_TYPE === "all" || TX_TYPE === "deploy") {
    results.push(await measureDeployLatency());
  }

  if (TX_TYPE === "all" || TX_TYPE === "call") {
    results.push(await measureCallLatency());
  }

  const totalTime = Date.now() - startTime;

  // Print summary
  printSummary(results);

  console.log("\n" + "=".repeat(70));
  console.log("🎉 LATENCY TEST COMPLETED!");
  console.log("=".repeat(70));
  console.log(`   Total Test Time: ${(totalTime / 1000).toFixed(2)}s`);
}

main().catch((error) => {
  console.error("\n❌ Fatal Error:", error);
  process.exit(1);
});
