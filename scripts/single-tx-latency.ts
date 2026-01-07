import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	createPublicClient,
	createWalletClient,
	defineChain,
	encodeFunctionData,
	formatEther,
	formatUnits,
	http,
	parseUnits,
	type TransactionReceipt,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

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
const TX_TYPE =
	process.argv.slice(2).find((arg) => !arg.startsWith("--")) || "all";

if (!validTypes.includes(TX_TYPE)) {
	console.error("❌ Invalid transaction type. Must be one of:");
	console.error("   - all      : Run all latency tests (default)");
	console.error("   - transfer : Mock USDC ERC20 transfer");
	console.error("   - deploy   : Counter contract deployment");
	console.error("   - call     : Counter contract function call");
	console.error("");
	console.error("Options:");
	console.error(
		"   --fast    : Use eth_sendRawTransactionSync (blocks until included)",
	);
	console.error("");
	console.error("Usage: bun run scripts/single-tx-latency.ts [type] [--fast]");
	console.error("");
	console.error(
		"Example: bun run scripts/single-tx-latency.ts transfer --fast",
	);
	process.exit(1);
}

// Define Sophon testnet
const sophonTestnet = defineChain({
	id: 531050204,
	name: "Sophon Testnet",
	nativeCurrency: { decimals: 18, name: "Sophon", symbol: "SOPH" },
	rpcUrls: {
		default: { http: ["https://rpc.testnet.os.sophon.com"] },
	},
});

// Polling interval optimized for 200ms block times (only used in normal mode)
const POLLING_INTERVAL = 100;

// RPC URL for direct requests
const RPC_URL = "https://rpc.testnet.os.sophon.com";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const publicClient = createPublicClient({
	chain: sophonTestnet,
	transport: http(RPC_URL, {
		retryCount: 3,
		retryDelay: 500,
		timeout: 60_000, // Longer timeout for sync calls
	}),
	pollingInterval: POLLING_INTERVAL,
	batch: {
		multicall: true,
	},
});
const walletClient = createWalletClient({
	account,
	chain: sophonTestnet,
	transport: http(RPC_URL),
});

// Load Counter contract artifact
const counterArtifactPath = join(
	process.cwd(),
	"artifacts/contracts/Counter.sol/Counter.json",
);
const counterArtifact = JSON.parse(readFileSync(counterArtifactPath, "utf8"));

interface LatencyResult {
	type: string;
	txHash: string;
	/**
	 * Time spent pre-filling tx fields (gas/fees/nonce) outside the timed send call.
	 * Only populated in --fast mode.
	 */
	prefillLatency: number;
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
	console.log(`\n${"-".repeat(70)}`);
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
		console.log(
			`\n   ⚠️  Insufficient ${symbol} balance, attempting to mint...`,
		);
		try {
			const mintAmount = parseUnits("1000", decimals); // Mint 1000 tokens
			const mintHash = await walletClient.writeContract({
				address: MOCK_USDC_ADDRESS,
				abi: ERC20_ABI,
				functionName: "mint",
				args: [account.address, mintAmount],
			});
			console.log(
				`   Minting ${formatUnits(mintAmount, decimals)} ${symbol}...`,
			);
			await publicClient.waitForTransactionReceipt({
				hash: mintHash,
				timeout: 60_000,
			});
			console.log(`   ✅ Minted successfully!`);
		} catch (mintError: unknown) {
			const errorMessage =
				mintError instanceof Error
					? mintError.message.slice(0, 100)
					: "Unknown error";
			console.error(`\n   ❌ Could not mint ${symbol}: ${errorMessage}`);
			console.error(
				`   Get test tokens from: https://explorer.testnet.os.sophon.com/address/${MOCK_USDC_ADDRESS}`,
			);
			throw new Error(`Insufficient ${symbol} balance and mint failed`);
		}
	}

	// Get preflight info
	const blockNumber = await publicClient.getBlockNumber();

	console.log(`   Pre-flight block: #${blockNumber}`);
	console.log(
		`   Mode: ${FAST_MODE ? "sendTransactionSync (eth_sendRawTransactionSync)" : "sendTransaction + polling"}`,
	);

	let receipt: TransactionReceipt;
	let txHash: `0x${string}`;
	let submissionLatency: number;
	let confirmationLatency: number;
	let totalLatency: number;
	let startBlockNumber = blockNumber;
	let prefillLatency = 0;

	if (FAST_MODE) {
		// Fast mode: Use sendTransactionSync which blocks until included.
		// For Local Accounts, Viem uses `eth_sendRawTransactionSync`.
		// Docs: https://viem.sh/docs/actions/wallet/sendTransactionSync
		const data = encodeFunctionData({
			abi: ERC20_ABI,
			functionName: "transfer",
			args: [account.address, transferAmount],
		});

		// Prefill tx fields OUTSIDE timed region to avoid measuring internal
		// estimation/fee/nonce overhead inside sendTransactionSync.
		const prefillStart = performance.now();
		const [gas, gasPrice, nonce] = await Promise.all([
			publicClient.estimateGas({
				account: account.address,
				to: MOCK_USDC_ADDRESS,
				data,
			}),
			publicClient.getGasPrice(),
			publicClient.getTransactionCount({ address: account.address }),
		]);
		const prefillEnd = performance.now();
		prefillLatency = prefillEnd - prefillStart;
		console.log(
			`   ⏱️  Prefill (gas/fee/nonce): ${prefillLatency.toFixed(2)}ms`,
		);

		startBlockNumber = await publicClient.getBlockNumber();

		// === TIMING: Send + Confirm in one call ===
		const submitStart = performance.now();

		receipt = await walletClient.sendTransactionSync({
			to: MOCK_USDC_ADDRESS,
			data,
			gas,
			gasPrice,
			nonce,
			timeout: 20_000,
		});
		txHash = receipt.transactionHash;

		const submitEnd = performance.now();
		totalLatency = submitEnd - submitStart;
		submissionLatency = totalLatency; // In sync mode, submission includes confirmation
		confirmationLatency = 0; // No separate confirmation step

		console.log(`   TX Hash: ${txHash}`);
		console.log(
			`   ⏱️  Sync Latency: ${totalLatency.toFixed(2)}ms (submit + confirm combined)`,
		);
	} else {
		// Normal mode: Use async send + wait for receipt
		const submitStart = performance.now();

		txHash = await walletClient.writeContract({
			address: MOCK_USDC_ADDRESS,
			abi: ERC20_ABI,
			functionName: "transfer",
			args: [account.address, transferAmount],
		});

		const submitEnd = performance.now();
		submissionLatency = submitEnd - submitStart;

		console.log(`   TX Hash: ${txHash}`);
		console.log(`   ⏱️  Submission Latency: ${submissionLatency.toFixed(2)}ms`);

		// === TIMING: Transaction Confirmation ===
		const confirmStart = performance.now();

		receipt = await publicClient.waitForTransactionReceipt({
			hash: txHash,
			timeout: 60_000,
		});

		const confirmEnd = performance.now();
		confirmationLatency = confirmEnd - confirmStart;
		totalLatency = confirmEnd - submitStart;
	}

	const result: LatencyResult = {
		type: "ERC20",
		txHash,
		prefillLatency,
		submissionLatency,
		confirmationLatency,
		totalLatency,
		blockNumber: receipt.blockNumber,
		blocksWaited: Number(receipt.blockNumber - startBlockNumber),
		gasUsed: receipt.gasUsed,
		status: receipt.status,
	};

	printLatencyBreakdown(result);
	return result;
}

async function measureDeployLatency(): Promise<LatencyResult> {
	console.log(`\n${"-".repeat(70)}`);
	console.log("📤 Testing: Counter Contract Deployment");
	console.log("-".repeat(70));

	const blockNumber = await publicClient.getBlockNumber();

	console.log(`   Pre-flight block: #${blockNumber}`);
	console.log(
		`   Bytecode size: ${(counterArtifact.bytecode.length / 2 - 1).toLocaleString()} bytes`,
	);
	console.log(
		`   Mode: ${FAST_MODE ? "sendTransactionSync (eth_sendRawTransactionSync)" : "sendTransaction + polling"}`,
	);

	let receipt: TransactionReceipt;
	let txHash: `0x${string}`;
	let submissionLatency: number;
	let confirmationLatency: number;
	let totalLatency: number;
	let startBlockNumber = blockNumber;
	let prefillLatency = 0;

	if (FAST_MODE) {
		// Fast mode: Use sendTransactionSync for deployment (contract creation),
		// and prefill tx params outside the timed region.
		// Docs: https://viem.sh/docs/actions/wallet/sendTransactionSync
		const bytecode = counterArtifact.bytecode as `0x${string}`;

		const prefillStart = performance.now();
		const [gas, gasPrice, nonce] = await Promise.all([
			publicClient.estimateGas({
				account: account.address,
				data: bytecode,
			}),
			publicClient.getGasPrice(),
			publicClient.getTransactionCount({ address: account.address }),
		]);
		const prefillEnd = performance.now();
		prefillLatency = prefillEnd - prefillStart;
		console.log(
			`   ⏱️  Prefill (gas/fee/nonce): ${prefillLatency.toFixed(2)}ms`,
		);

		startBlockNumber = await publicClient.getBlockNumber();

		const submitStart = performance.now();

		receipt = await walletClient.sendTransactionSync({
			data: bytecode,
			gas,
			gasPrice,
			nonce,
			timeout: 20_000,
		});
		txHash = receipt.transactionHash;

		const submitEnd = performance.now();
		totalLatency = submitEnd - submitStart;
		submissionLatency = totalLatency;
		confirmationLatency = 0;

		console.log(`   TX Hash: ${txHash}`);
		console.log(
			`   ⏱️  Sync Latency: ${totalLatency.toFixed(2)}ms (submit + confirm combined)`,
		);
	} else {
		// Normal mode: Use async deploy + wait for receipt
		const submitStart = performance.now();

		txHash = await walletClient.deployContract({
			abi: counterArtifact.abi,
			bytecode: counterArtifact.bytecode as `0x${string}`,
			args: [],
		});

		const submitEnd = performance.now();
		submissionLatency = submitEnd - submitStart;

		console.log(`   TX Hash: ${txHash}`);
		console.log(`   ⏱️  Submission Latency: ${submissionLatency.toFixed(2)}ms`);

		const confirmStart = performance.now();

		receipt = await publicClient.waitForTransactionReceipt({
			hash: txHash,
			timeout: 60_000,
		});

		const confirmEnd = performance.now();
		confirmationLatency = confirmEnd - confirmStart;
		totalLatency = confirmEnd - submitStart;
	}

	const result: LatencyResult = {
		type: "Deploy",
		txHash,
		prefillLatency,
		submissionLatency,
		confirmationLatency,
		totalLatency,
		blockNumber: receipt.blockNumber,
		blocksWaited: Number(receipt.blockNumber - startBlockNumber),
		gasUsed: receipt.gasUsed,
		status: receipt.status,
		contractAddress: receipt.contractAddress ?? undefined,
	};

	printLatencyBreakdown(result);
	console.log(`   Contract: ${result.contractAddress}`);
	return result;
}

async function measureCallLatency(): Promise<LatencyResult> {
	console.log(`\n${"-".repeat(70)}`);
	console.log("📤 Testing: Counter Contract Function Call (inc)");
	console.log("-".repeat(70));

	// First deploy a Counter contract
	console.log("   Deploying Counter contract...");

	let contractAddress: `0x${string}`;

	if (FAST_MODE) {
		// Deploy using sendTransactionSync (prefill params outside timed region)
		const bytecode = counterArtifact.bytecode as `0x${string}`;
		const [gas, gasPrice, nonce] = await Promise.all([
			publicClient.estimateGas({
				account: account.address,
				data: bytecode,
			}),
			publicClient.getGasPrice(),
			publicClient.getTransactionCount({ address: account.address }),
		]);

		const deployReceipt = await walletClient.sendTransactionSync({
			data: bytecode,
			gas,
			gasPrice,
			nonce,
			timeout: 20_000,
		});
		contractAddress = deployReceipt.contractAddress as `0x${string}`;
	} else {
		const deployHash = await walletClient.deployContract({
			abi: counterArtifact.abi,
			bytecode: counterArtifact.bytecode as `0x${string}`,
			args: [],
		});
		const deployReceipt = await publicClient.waitForTransactionReceipt({
			hash: deployHash,
			timeout: 60_000,
		});
		contractAddress = deployReceipt.contractAddress as `0x${string}`;
	}

	console.log(`   Contract deployed at: ${contractAddress}`);

	const blockNumber = await publicClient.getBlockNumber();

	console.log(`   Pre-flight block: #${blockNumber}`);
	console.log(
		`   Mode: ${FAST_MODE ? "sendTransactionSync (eth_sendRawTransactionSync)" : "sendTransaction + polling"}`,
	);

	let receipt: TransactionReceipt;
	let txHash: `0x${string}`;
	let submissionLatency: number;
	let confirmationLatency: number;
	let totalLatency: number;
	let startBlockNumber = blockNumber;
	let prefillLatency = 0;

	// Prepare the function call data
	const data = encodeFunctionData({
		abi: counterArtifact.abi,
		functionName: "inc",
		args: [],
	});

	if (FAST_MODE) {
		// Fast mode: Use sendTransactionSync (prefill fields outside timed region)
		const prefillStart = performance.now();
		const [gas, gasPrice, nonce] = await Promise.all([
			publicClient.estimateGas({
				account: account.address,
				to: contractAddress,
				data,
			}),
			publicClient.getGasPrice(),
			publicClient.getTransactionCount({ address: account.address }),
		]);
		const prefillEnd = performance.now();
		prefillLatency = prefillEnd - prefillStart;
		console.log(
			`   ⏱️  Prefill (gas/fee/nonce): ${prefillLatency.toFixed(2)}ms`,
		);

		startBlockNumber = await publicClient.getBlockNumber();

		const submitStart = performance.now();

		receipt = await walletClient.sendTransactionSync({
			to: contractAddress,
			data,
			gas,
			gasPrice,
			nonce,
			timeout: 20_000,
		});
		txHash = receipt.transactionHash;

		const submitEnd = performance.now();
		totalLatency = submitEnd - submitStart;
		submissionLatency = totalLatency;
		confirmationLatency = 0;

		console.log(`   TX Hash: ${txHash}`);
		console.log(
			`   ⏱️  Sync Latency: ${totalLatency.toFixed(2)}ms (submit + confirm combined)`,
		);
	} else {
		// Normal mode: Use async send + wait for receipt
		const submitStart = performance.now();

		txHash = await walletClient.writeContract({
			address: contractAddress,
			abi: counterArtifact.abi,
			functionName: "inc",
			args: [],
		});

		const submitEnd = performance.now();
		submissionLatency = submitEnd - submitStart;

		console.log(`   TX Hash: ${txHash}`);
		console.log(`   ⏱️  Submission Latency: ${submissionLatency.toFixed(2)}ms`);

		const confirmStart = performance.now();

		receipt = await publicClient.waitForTransactionReceipt({
			hash: txHash,
			timeout: 60_000,
		});

		const confirmEnd = performance.now();
		confirmationLatency = confirmEnd - confirmStart;
		totalLatency = confirmEnd - submitStart;
	}

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
		prefillLatency,
		submissionLatency,
		confirmationLatency,
		totalLatency,
		blockNumber: receipt.blockNumber,
		blocksWaited: Number(receipt.blockNumber - startBlockNumber),
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
	console.log(
		`   ├─ Confirmation:  ${result.confirmationLatency.toFixed(2)}ms`,
	);
	console.log(
		`   └─ Total E2E:     ${result.totalLatency.toFixed(2)}ms (${(result.totalLatency / 1000).toFixed(3)}s)`,
	);
	console.log(`\n   📦 TRANSACTION DETAILS:`);
	console.log(`   ├─ Status: ${result.status}`);
	console.log(`   ├─ Block: #${result.blockNumber}`);
	console.log(`   ├─ Gas Used: ${result.gasUsed}`);
	console.log(`   └─ Blocks waited: ${result.blocksWaited}`);
}

function printSummary(results: LatencyResult[]): void {
	console.log(`\n${"=".repeat(70)}`);
	console.log("📊 LATENCY TEST SUMMARY");
	console.log("=".repeat(70));

	const avgPrefill =
		results.reduce((sum, r) => sum + r.prefillLatency, 0) / results.length;
	const avgSubmission =
		results.reduce((sum, r) => sum + r.submissionLatency, 0) / results.length;
	const avgConfirmation =
		results.reduce((sum, r) => sum + r.confirmationLatency, 0) / results.length;
	const avgTotal =
		results.reduce((sum, r) => sum + r.totalLatency, 0) / results.length;
	const avgTotalWithPrefill =
		results.reduce((sum, r) => sum + (r.prefillLatency + r.totalLatency), 0) /
		results.length;

	console.log(`\n   Tests Run: ${results.length}`);
	console.log(
		`   All Successful: ${results.every((r) => r.status === "success") ? "✅" : "❌"}`,
	);

	console.log(`\n   ⏱️  AVERAGE LATENCIES:`);
	console.log(`   ├─ Prefill:       ${avgPrefill.toFixed(2)}ms`);
	console.log(`   ├─ Submission:    ${avgSubmission.toFixed(2)}ms`);
	console.log(`   ├─ Confirmation:  ${avgConfirmation.toFixed(2)}ms`);
	console.log(
		`   └─ Total E2E:     ${avgTotal.toFixed(2)}ms (${(avgTotal / 1000).toFixed(3)}s)`,
	);
	console.log(
		`   └─ Total+Prefill: ${avgTotalWithPrefill.toFixed(2)}ms (${(avgTotalWithPrefill / 1000).toFixed(3)}s)`,
	);

	console.log(`\n   📋 INDIVIDUAL RESULTS:`);
	console.log(
		`   ${"Type".padEnd(10)} ${"Prefill".padStart(10)} ${"Submit".padStart(10)} ${"Confirm".padStart(10)} ${"Total".padStart(12)} ${"Blocks".padStart(8)}`,
	);
	console.log(`   ${"-".repeat(62)}`);
	for (const r of results) {
		console.log(
			`   ${r.type.padEnd(10)} ${r.prefillLatency.toFixed(0).padStart(8)}ms ${r.submissionLatency.toFixed(0).padStart(8)}ms ${r.confirmationLatency.toFixed(0).padStart(8)}ms ${r.totalLatency.toFixed(0).padStart(10)}ms ${r.blocksWaited.toString().padStart(8)}`,
		);
	}
}

async function main() {
	console.log(`\n📊 Configuration:`);
	console.log(`   Test Type: ${TX_TYPE}`);
	console.log(
		`   Fast Mode: ${FAST_MODE ? "✅ ENABLED (sendTransactionSync / EIP-7966)" : "❌ disabled (use --fast to enable)"}`,
	);
	if (FAST_MODE) {
		console.log(
			"   Note: fast mode times only the sync sendTransactionSync call; gas/fee/nonce prefill is shown separately.",
		);
	}
	console.log(`   Account: ${account.address}`);
	if (!FAST_MODE) {
		console.log(`   Polling Interval: ${POLLING_INTERVAL}ms`);
	}

	// Check RPC availability
	console.log(`\n🔍 Checking RPC availability...`);
	let balance: bigint;
	let nonce: number;

	try {
		balance = await publicClient.getBalance({ address: account.address });
		nonce = await publicClient.getTransactionCount({
			address: account.address,
		});
	} catch (error: unknown) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		console.error(`\n❌ RPC Error: ${errorMessage}`);
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

	console.log(`\n${"=".repeat(70)}`);
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

	console.log(`\n${"=".repeat(70)}`);
	console.log("🎉 LATENCY TEST COMPLETED!");
	console.log("=".repeat(70));
	console.log(`   Total Test Time: ${(totalTime / 1000).toFixed(2)}s`);
}

main().catch((error) => {
	console.error("\n❌ Fatal Error:", error);
	process.exit(1);
});
