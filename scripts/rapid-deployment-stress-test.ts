import {
  createWalletClient,
  createPublicClient,
  http,
  defineChain,
  formatEther,
  parseEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

console.log("🚀 RAPID STRESS TEST");
console.log("=".repeat(70));

if (!process.env.PRIVATE_KEY) {
  console.error("❌ Error: PRIVATE_KEY environment variable not set");
  process.exit(1);
}

// Parse command line arguments
const TX_TYPE = process.argv[2] || "transfer";

if (!["transfer", "counter", "factory100"].includes(TX_TYPE)) {
  console.error("❌ Invalid transaction type. Must be one of:");
  console.error("   - transfer    : 0.1 SOPH transfer to self (default)");
  console.error("   - counter     : Deploy Counter contract");
  console.error("   - factory100  : Deploy 100-Factory Chain");
  process.exit(1);
}

// Configuration
const TOTAL_DEPLOYMENTS = 1000;

// Define Sophon testnet
const sophonTestnet = defineChain({
  id: 531050204,
  name: "Sophon Testnet",
  nativeCurrency: { decimals: 18, name: "Sophon", symbol: "SOPH" },
  rpcUrls: {
    default: { http: ["https://zksync-os-testnet-sophon.zksync.dev"] },
  },
});

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const publicClient = createPublicClient({
  chain: sophonTestnet,
  transport: http(undefined, {
    retryCount: 5,
    retryDelay: 1000,
    timeout: 30_000,
  }),
});
const walletClient = createWalletClient({
  account,
  chain: sophonTestnet,
  transport: http(undefined, {
    retryCount: 5,
    retryDelay: 1000,
    timeout: 30_000,
  }),
});

// Load contract artifact if needed
let artifact: any = null;
if (TX_TYPE === "counter") {
  const artifactPath = join(
    process.cwd(),
    "artifacts/contracts/Counter.sol/Counter.json"
  );
  artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
} else if (TX_TYPE === "factory100") {
  const artifactPath = join(
    process.cwd(),
    "artifacts/contracts/FactoryChain100.sol/Factory1.json"
  );
  artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
}

interface TxResult {
  index: number;
  hash: string;
  nonce: number;
  submittedAt: number;
  confirmedAt?: number;
  blockNumber?: bigint;
  gasUsed?: bigint;
  status?: "success" | "reverted";
  error?: string;
  inclusionTime?: number; // ms
}

const results: TxResult[] = [];

async function main() {
  console.log(`\n📊 Configuration:`);
  console.log(`   Total Transactions: ${TOTAL_DEPLOYMENTS}`);
  
  if (TX_TYPE === "transfer") {
    console.log(`   Transaction Type: 0.1 SOPH Transfer to Self`);
  } else if (TX_TYPE === "counter") {
    console.log(`   Transaction Type: Counter Deployment`);
  } else if (TX_TYPE === "factory100") {
    console.log(`   Transaction Type: 100-Factory Chain (each TX deploys 100 contracts!)`);
    console.log(`   Total Contracts: ${TOTAL_DEPLOYMENTS * 100} contracts`);
  }
  
  console.log(`   Mode: MAXIMUM SPEED - No batching, no delays`);
  console.log(`   Account: ${account.address}`);

  // Check RPC availability
  console.log(`\n🔍 Checking RPC availability...`);
  let balance: bigint;
  let nonce: number;

  try {
    balance = await publicClient.getBalance({ address: account.address });
    nonce = await publicClient.getTransactionCount({
      address: account.address,
    });
  } catch (error: any) {
    console.error(`\n❌ RPC Error: ${error.message}`);
    console.error(`\n⚠️  Possible issues:`);
    console.error(`   - RPC endpoint is down or overloaded`);
    console.error(`   - Network connectivity issues`);
    console.error(`   - Try again in a few moments`);
    process.exit(1);
  }

  console.log(`   Starting Balance: ${formatEther(balance)} SOPH`);
  console.log(`   Starting Nonce: ${nonce}`);

  console.log("\n" + "=".repeat(70));
  console.log(`🔥 STARTING RAPID ${TX_TYPE.toUpperCase()}...`);
  console.log("=".repeat(70));

  const overallStartTime = Date.now();
  const submissionPromises: Promise<void>[] = [];

  // Send ALL transactions concurrently - MAXIMUM SPEED
  for (let i = 0; i < TOTAL_DEPLOYMENTS; i++) {
    const txIndex = i;
    const txNonce = nonce + i;

    const submissionPromise = (async () => {
      try {
        const submittedAt = Date.now();
        let hash: `0x${string}`;

        // Send appropriate transaction type
        if (TX_TYPE === "transfer") {
          // Transfer 0.1 SOPH to self
          hash = await walletClient.sendTransaction({
            to: account.address,
            value: parseEther("0.1"),
            nonce: txNonce,
          });
        } else {
          // Deploy contract (counter or factory100)
          hash = await walletClient.deployContract({
            abi: artifact.abi,
            bytecode: artifact.bytecode as `0x${string}`,
            args: [],
            nonce: txNonce,
          });
        }

        results.push({
          index: txIndex,
          hash,
          nonce: txNonce,
          submittedAt,
        });

        // Show progress every 100 transactions
        if ((txIndex + 1) % 100 === 0 || txIndex === 0) {
          const elapsed = ((Date.now() - overallStartTime) / 1000).toFixed(2);
          console.log(
            `   📤 Submitted ${txIndex + 1}/${TOTAL_DEPLOYMENTS} (${elapsed}s) - Hash: ${hash.slice(0, 10)}...`
          );
        }
      } catch (error: any) {
        const errorInfo = {
          message: error.message,
          shortMessage: error.shortMessage,
          details: error.details,
          cause: error.cause,
          data: error.data,
          code: error.code,
          version: error.version,
        };
        
        results.push({
          index: txIndex,
          hash: "FAILED",
          nonce: txNonce,
          submittedAt: Date.now(),
          error: JSON.stringify(errorInfo),
        });
        
        // Print first error in full detail
        if (results.filter(r => r.hash === "FAILED").length === 1) {
          console.log(`\n❌ FIRST ERROR (TX #${txIndex}, nonce ${txNonce}):`);
          console.log(JSON.stringify(errorInfo, null, 2));
          console.log();
        }
      }
    })();

    submissionPromises.push(submissionPromise);
  }

  // Wait for all submissions to complete
  await Promise.all(submissionPromises);

  const submissionEndTime = Date.now();
  const submissionDuration = (submissionEndTime - overallStartTime) / 1000;

  console.log("\n" + "=".repeat(70));
  console.log("✅ ALL TRANSACTIONS SUBMITTED");
  console.log("=".repeat(70));
  console.log(`   Submission Time: ${submissionDuration.toFixed(2)}s`);
  console.log(
    `   Submission Rate: ${(TOTAL_DEPLOYMENTS / submissionDuration).toFixed(2)} tx/s`
  );

  const successfulSubmissions = results.filter((r) => r.hash !== "FAILED");
  const failedSubmissions = results.filter((r) => r.hash === "FAILED");

  console.log(`   Submitted Successfully: ${successfulSubmissions.length}`);
  console.log(`   Failed to Submit: ${failedSubmissions.length}`);

  if (failedSubmissions.length > 0) {
    console.log(`\n⚠️  Submission Failures Summary:`);
    console.log(`   Total Failed: ${failedSubmissions.length}`);
    console.log(`\n   Sample Error (TX #${failedSubmissions[0].index}):`);
    try {
      const parsedError = JSON.parse(failedSubmissions[0].error || "{}");
      console.log(JSON.stringify(parsedError, null, 2));
    } catch {
      console.log(`   ${failedSubmissions[0].error}`);
    }
  }

  // Now wait for confirmations
  console.log("\n" + "=".repeat(70));
  console.log("⏳ WAITING FOR CONFIRMATIONS...");
  console.log("=".repeat(70));

  let confirmed = 0;
  let failed = 0;

  const confirmationPromises = successfulSubmissions.map(async (result) => {
    try {
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: result.hash as `0x${string}`,
        timeout: 120_000, // 2 minute timeout
      });

      result.confirmedAt = Date.now();
      result.blockNumber = receipt.blockNumber;
      result.gasUsed = receipt.gasUsed;
      result.status = receipt.status;
      result.inclusionTime = result.confirmedAt - result.submittedAt;

      confirmed++;

      if (confirmed % 100 === 0) {
        console.log(`   ✅ Confirmed: ${confirmed}/${successfulSubmissions.length}`);
      }
    } catch (error: any) {
      result.error = error.message?.slice(0, 100);
      failed++;
    }
  });

  await Promise.all(confirmationPromises);

  const overallEndTime = Date.now();
  const totalDuration = (overallEndTime - overallStartTime) / 1000;

  // Calculate statistics
  const confirmedTxs = results.filter((r) => r.status);
  const successfulTxs = confirmedTxs.filter((r) => r.status === "success");
  const revertedTxs = confirmedTxs.filter((r) => r.status === "reverted");

  const inclusionTimes = confirmedTxs
    .map((r) => r.inclusionTime!)
    .filter((t) => t !== undefined);

  const avgInclusionTime =
    inclusionTimes.reduce((a, b) => a + b, 0) / inclusionTimes.length;
  const minInclusionTime = Math.min(...inclusionTimes);
  const maxInclusionTime = Math.max(...inclusionTimes);
  const medianInclusionTime = inclusionTimes.sort((a, b) => a - b)[
    Math.floor(inclusionTimes.length / 2)
  ];

  const totalGasUsed = successfulTxs.reduce(
    (sum, r) => sum + (r.gasUsed || 0n),
    0n
  );

  // Get unique blocks
  const blocks = new Set(
    confirmedTxs.map((r) => r.blockNumber?.toString()).filter(Boolean)
  );

  // Generate report
  console.log("\n" + "=".repeat(70));
  console.log("📊 STRESS TEST RESULTS");
  console.log("=".repeat(70));

  console.log(`\n⏱️  TIMING:`);
  console.log(`   Total Duration: ${totalDuration.toFixed(2)}s`);
  console.log(`   Submission Phase: ${submissionDuration.toFixed(2)}s`);
  console.log(`   Confirmation Phase: ${(totalDuration - submissionDuration).toFixed(2)}s`);
  console.log(
    `   Overall Throughput: ${(TOTAL_DEPLOYMENTS / totalDuration).toFixed(2)} tx/s`
  );

  console.log(`\n📈 TRANSACTION STATUS:`);
  console.log(`   Total Attempted: ${TOTAL_DEPLOYMENTS}`);
  console.log(`   Submitted: ${successfulSubmissions.length}`);
  console.log(`   Confirmed: ${confirmed}`);
  console.log(`   Successful: ${successfulTxs.length} ✅`);
  console.log(`   Reverted: ${revertedTxs.length} ❌`);
  console.log(`   Failed/Timeout: ${failed + failedSubmissions.length} ⚠️`);

  const successRate = ((successfulTxs.length / TOTAL_DEPLOYMENTS) * 100).toFixed(2);
  console.log(`\n   Success Rate: ${successRate}%`);

  console.log(`\n⏱️  INCLUSION TIME (Submission → Confirmation):`);
  console.log(`   Average: ${(avgInclusionTime / 1000).toFixed(2)}s`);
  console.log(`   Median: ${(medianInclusionTime / 1000).toFixed(2)}s`);
  console.log(`   Min: ${(minInclusionTime / 1000).toFixed(2)}s`);
  console.log(`   Max: ${(maxInclusionTime / 1000).toFixed(2)}s`);

  console.log(`\n⛽ GAS USAGE:`);
  console.log(`   Total Gas Used: ${totalGasUsed.toLocaleString()}`);
  if (successfulTxs.length > 0) {
    const avgGas = Number(totalGasUsed / BigInt(successfulTxs.length));
    console.log(`   Average per TX: ${avgGas.toLocaleString()}`);
  }

  console.log(`\n📦 BLOCKS:`);
  console.log(`   Transactions spread across ${blocks.size} blocks`);
  console.log(
    `   Average TXs per block: ${(successfulTxs.length / blocks.size).toFixed(2)}`
  );

  // Save detailed results
  const reportPath = join(
    process.cwd(),
    `stress-test-report-${Date.now()}.json`
  );
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        config: {
          txType: TX_TYPE,
          totalTransactions: TOTAL_DEPLOYMENTS,
          mode: "MAXIMUM_SPEED",
          batching: false,
          ...(TX_TYPE === "factory100" && {
            contractsPerTx: 100,
            totalContracts: TOTAL_DEPLOYMENTS * 100,
          }),
          network: "Sophon Testnet",
          chainId: 531050204,
        },
        summary: {
          totalDuration,
          submissionDuration,
          totalAttempted: TOTAL_DEPLOYMENTS,
          submitted: successfulSubmissions.length,
          confirmed,
          successful: successfulTxs.length,
          reverted: revertedTxs.length,
          failed: failed + failedSubmissions.length,
          successRate: parseFloat(successRate),
        },
        timing: {
          avgInclusionTime,
          medianInclusionTime,
          minInclusionTime,
          maxInclusionTime,
        },
        gas: {
          total: totalGasUsed.toString(),
          average:
            successfulTxs.length > 0
              ? (totalGasUsed / BigInt(successfulTxs.length)).toString()
              : "0",
        },
        blocks: {
          count: blocks.size,
          avgTxsPerBlock: successfulTxs.length / blocks.size,
        },
        transactions: results.map((r) => ({
          ...r,
          gasUsed: r.gasUsed?.toString(),
          blockNumber: r.blockNumber?.toString(),
        })),
      },
      null,
      2
    )
  );

  console.log(`\n💾 Detailed report saved: ${reportPath}`);

  console.log("\n" + "=".repeat(70));
  console.log("🎉 STRESS TEST COMPLETED!");
  console.log("=".repeat(70));
}

main().catch((error) => {
  console.error("\n❌ Fatal Error:", error);
  process.exit(1);
});

