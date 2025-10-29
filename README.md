# Sophon Testnet Stress Test Suite

Comprehensive stress testing tools for the Sophon EVM L2 testnet. This project includes multiple strategies for testing network performance, gas limits, and transaction throughput.


## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [RPC Endpoint Testing](#rpc-endpoint-testing)
3. [Compilation Options](#compilation-options)
4. [Stress Test Types](#stress-test-types)
5. [Factory Chain Contracts](#factory-chain-contracts)
6. [Usage Guide](#usage-guide)
7. [Results and Metrics](#results-and-metrics)
8. [Troubleshooting](#troubleshooting)

## 🚀 Quick Start

### Prerequisites

```bash
# Install dependencies
bun install

# Edit .env file with your private key (account needs SOPH testnet tokens)
nano .env

# Compile contracts (default)
bunx hardhat compile

# For 100-factory chain: compile with solx
HARDHAT_PROFILE=solx bunx hardhat compile
```

### Run Your First Test

```bash
# Start with simple transfers (cheapest, fastest)
bun run scripts/rapid-deployment-stress-test.ts transfer

# Or deploy Counter contracts
bun run scripts/rapid-deployment-stress-test.ts counter

# Or go big with 100-Factory Chain deployments (requires solx compilation)
bun run scripts/rapid-deployment-stress-test.ts factory100
```

## 🔍 RPC Endpoint Testing

### Test RPC Endpoint Support

The project includes a comprehensive RPC endpoint test suite that validates which JSON-RPC methods are supported by the Sophon Testnet.

**File**: `test/RpcEndpoints.ts`

**Quick Start:**
```bash
# Requires PRIVATE_KEY in .env file
# sophonTestnet is now the default network for this test
npx hardhat test test/RpcEndpoints.ts --network sophonTestnet
```

#### What It Tests

Tests all essential Ethereum JSON-RPC endpoints:

**✅ Core Methods:**
- `eth_blockNumber` - Get current block number
- `eth_getBlockByNumber` - Fetch block data
- `eth_getBlockReceipts` - Get all receipts for a block
- `eth_getTransactionByHash` - Get transaction details
- `eth_getTransactionReceipt` - Get transaction receipt
- `eth_sendRawTransaction` - Send signed transactions
- `eth_getTransactionCount` - Get account nonce
- `eth_getBalance` - Get account balance
- `eth_estimateGas` - Estimate transaction gas
- `eth_gasPrice` - Get current gas price
- `eth_getLogs` - Query event logs
- `web3_clientVersion` - Get client info

**🔄 Alternative Methods (Parity):**
- `parity_pendingTransactions` vs `eth_getBlockByNumber('pending')`
- `parity_getBlockReceipts` vs `eth_getBlockReceipts`
- `parity_nextNonce` vs `eth_getTransactionCount`

**🐛 Debug/Trace Methods:**
- `debug_traceBlockByNumber` / `trace_block`
- `debug_traceTransaction` / `trace_transaction`

#### Running the Tests

##### On Sophon Testnet (Default)
```bash
# Test against live Sophon testnet (default network for this test)
# Requires PRIVATE_KEY in .env file
npx hardhat test test/RpcEndpoints.ts --network sophonTestnet

# Uses real on-chain data:
# - Address: 0x44Cdb1e839A2c0D1E0d4f491a8CB14599D253281
# - Example TX: 0x9ce2ce2beac5d2197b596cb50964f14ca2d174facdc7c614dd1ce4972b1e240c

# Expected output:
# - 13 passing (all standard RPC methods)
# - 2 failing (debug/trace methods not supported - expected)
```

##### On Local Hardhat Network

> **⚠️ Known Limitation:** Local Hardhat testing has serialization issues with Node's test runner and custom viem clients. This test suite is specifically designed to validate the Sophon Testnet RPC endpoints. Please use the Sophon Testnet for accurate results.

```bash
# Not recommended - use Sophon testnet instead
npx hardhat test test/RpcEndpoints.ts
```

#### Test Results for Sophon Testnet

**✅ Supported (13/15 core endpoints):**
- All standard Ethereum RPC methods work
- `eth_getBlockReceipts` is supported (modern standard)
- Client: `zksync-os/v0.8.3`

**❌ Not Supported:**
- Parity-specific methods (`parity_*`)
- Debug/trace methods (not enabled)

#### Understanding the Output

The test provides clear indicators:
- `✓` - Method is supported and working
- `✗` - Method is not supported or returned error
- `⚠` - Alternative methods tested, none supported

Example output:
```
✓ eth_blockNumber: 13076
✓ eth_getBalance: 9049.999823721135087 ETH
✓ web3_clientVersion: zksync-os/v0.8.3
✗ debug_traceBlockByNumber not supported: default struct log tracer is not supported
⚠ Neither debug_traceBlockByNumber nor trace_block is supported
```

## 🔧 Compilation Options

This project supports two compilation modes:

### Default: Standard Solc with `--via-ir`

The default profile uses the standard Solidity compiler with optimization and the intermediate representation (IR) pipeline:

```bash
# Compile with solx (default)
bunx hardhat compile
```

**Features:**
- ✅ Full EVM compatibility
- ✅ Optimized bytecode via IR pipeline
- ✅ Works for 10-factory chain and Counter contracts
- ✅ Standard deployment to any EVM chain

**Configuration:**
```typescript
{
  optimizer: { enabled: true, runs: 200 },
  viaIR: true
}
```

**Use this for:**
- Transfer tests
- Counter deployments
- 10-factory chain



**Features:**
- ⚡ More gas-efficient bytecode for EVM
- 🔧 Advanced optimization techniques
- ✅ Full EVM compatibility
- ✅ **Required for 100-factory chain** (produces smaller initcode)

**Use this for:**
- 100-factory chain deployments (required)
- Any test where you want maximum gas efficiency

**Requirements:**
```bash
# Install solx (example for Linux)
wget https://github.com/matter-labs/era-solidity/releases/download/v0.1.2/solx-linux-amd64-gnu-v0.1.2
chmod +x solx-linux-amd64-gnu-v0.1.2
mv solx-linux-amd64-gnu-v0.1.2 ~/
```

> **Important:** The 100-factory chain **requires** solx compilation. Standard solc produces initcode that exceeds deployment size limits (>49KB).

## 🧪 Stress Test Types

### 1. Rapid Deployment Stress Test

**File**: `scripts/rapid-deployment-stress-test.ts`

The most flexible stress test with three transaction modes:

#### Transaction Types

##### `transfer` (Default)
- Sends 0.1 SOPH to self
- Minimal gas usage (~21,000 gas)
- Best for testing RPC throughput
- Fastest execution

```bash
bun run scripts/rapid-deployment-stress-test.ts transfer
```

##### `counter`
- Deploys simple Counter contract
- Moderate gas usage (~200,000 gas)
- Tests basic contract deployment

```bash
bun run scripts/rapid-deployment-stress-test.ts counter
```

##### `factory100`
- Deploys 100-Factory Chain (100 contracts in 1 tx!)
- Maximum gas usage (~15M+ gas per tx)
- Ultimate stress test
- Each transaction creates 100 nested contracts

```bash
bun run scripts/rapid-deployment-stress-test.ts factory100
```

#### Configuration

Edit this constant in the script to adjust test size:

```typescript
const TOTAL_DEPLOYMENTS = 1000;  // Total transactions to send
```

#### Features

- ✅ **Manual Nonce Management** - No waiting for confirmations
- ✅ **Maximum Speed** - All transactions sent concurrently (no batching, no delays)
- ✅ **Failure Tracking** - Monitors submission and confirmation failures
- ✅ **Inclusion Time Metrics** - Tracks time from submission to confirmation
- ✅ **Detailed Error Logging** - Full RPC error response for debugging
- ✅ **JSON Report Export** - Saves comprehensive results
- 🔥 **True Stress Testing** - Pushes RPC to its absolute limits

### 2. Single Factory Chain Deployment

**Files**: `scripts/deploy-factory-chain.ts`, `scripts/deploy-factory-chain-100.ts`

Deploys a single chain of nested factory contracts.

```bash
# Deploy 10-Factory Chain (single transaction)
bun run hardhat run scripts/deploy-factory-chain.ts --network sophon

# Deploy 100-Factory Chain (single transaction)
bun run hardhat run scripts/deploy-factory-chain-100.ts --network sophon
```

#### What Happens?

1. Deploy Factory1
2. Factory1's constructor deploys Factory2
3. Factory2's constructor deploys Factory3
4. ... continues until the final factory

**All in one transaction!** Tests:
- Single transaction gas limits
- Nested contract deployments (CREATE opcode)
- Constructor chaining
- Maximum call stack depth

## 🏭 Factory Chain Contracts

### FactoryChain.sol (10 Factories)

- **File**: `contracts/FactoryChain.sol`
- **Contracts**: Factory1 → Factory2 → ... → Factory10
- **Features**:
  - Each factory stores its number and deployment time
  - Emits `ContractDeployed(factoryNumber, deployedAddress, nextFactoryNumber)` event
  - Provides `getInfo()` and `getAllAddresses()` view functions

### FactoryChain100.sol (100 Factories)

- **File**: `contracts/FactoryChain100.sol`
- **Contracts**: Factory1 → Factory2 → ... → Factory100
- **Generation**: Programmatically generated via `scripts/generate-factory100.ts`
- **Compilation**: ⚠️ **Requires solx compiler** (standard solc produces initcode too large)
- **Gas Usage**: ~15-20M gas per deployment

> **Important**: The 100-factory chain must be compiled with solx for gas-efficient bytecode that fits within deployment limits.

## 📖 Usage Guide

### Setting Up

1. **Get Testnet Tokens**
   - Visit Sophon testnet faucet
   - Send SOPH to your test account

2. **Configure Environment**
   ```bash
   # Edit .env file with your private key
   nano .env
   ```

3. **Compile Contracts**
   
   For transfer and counter tests:
   ```bash
   bunx hardhat compile
   ```
   
   For factory100 tests (requires solx):
   ```bash
   HARDHAT_PROFILE=solx bunx hardhat compile
   ```

### Running Tests

#### Rapid Stress Test Examples

```bash
# Quick test: 100 transfers (edit TOTAL_DEPLOYMENTS = 100 in script)
bun run scripts/rapid-deployment-stress-test.ts transfer

# Medium test: 1000 Counter deployments (default)
bun run scripts/rapid-deployment-stress-test.ts counter

# MAXIMUM STRESS: 1000 x 100-Factory Chains = 100,000 contracts!
# ⚠️ Requires solx compilation first: HARDHAT_PROFILE=solx bunx hardhat compile
# All sent as fast as possible with no delays
bun run scripts/rapid-deployment-stress-test.ts factory100
```

#### Single Chain Deployments

```bash
# 10-Factory Chain (works with default compiler)
bun run hardhat run scripts/deploy-factory-chain.ts --network sophon

# 100-Factory Chain (requires solx compilation first)
HARDHAT_PROFILE=solx bunx hardhat compile
bun run hardhat run scripts/deploy-factory-chain-100.ts --network sophon
```

### Viewing Events

After deploying a factory chain, view the `ContractDeployed` events:

```bash
bun run scripts/view-events.ts
# Enter transaction hash when prompted
```

## 📊 Results and Metrics

### Stress Test Output

The rapid deployment stress test provides comprehensive metrics:

#### Timing
- **Submission Phase**: Time to submit all transactions
- **Confirmation Phase**: Time to confirm all transactions
- **Overall Throughput**: Transactions per second
- **Submission Rate**: TPS during submission phase

#### Transaction Status
- **Total Attempted**: Number of transactions sent
- **Submitted**: Successfully sent to RPC
- **Confirmed**: Received transaction receipt
- **Successful**: Confirmed with status = success
- **Reverted**: Confirmed but reverted
- **Failed/Timeout**: Submission failed or confirmation timeout

#### Inclusion Time
- **Average**: Mean time from submission to confirmation
- **Median**: Middle value (better for skewed distributions)
- **Min/Max**: Range of inclusion times

#### Gas Usage
- **Total Gas Used**: Sum of all successful transactions
- **Average per TX**: Mean gas per transaction

#### Block Distribution
- **Block Count**: Number of unique blocks containing transactions
- **TXs per Block**: How many transactions were included per block

### JSON Report

Each test run generates a detailed JSON report:

```
stress-test-report-[timestamp].json
```

Contains:
- Full configuration
- All transaction hashes
- Individual inclusion times
- Gas usage per transaction### Alternative: solx Compiler

The `solx` profile uses the [solx](https://solx.zksync.io/) compiler for maximum gas optimization on normal EVM chains:

```bash
# Compile with solx
HARDHAT_PROFILE=solx bunx hardhat compile
```
  timeout: 30_000,    // Request timeout (ms)
})
```

### Generate Custom Factory Chains

```bash
# Generate FactoryChain100.sol
bun run scripts/generate-factory100.ts

# Modify the script for different sizes
# Note: 1000+ factories hit compiler limits
```

## 🐛 Troubleshooting

### Common Issues

#### "insufficient funds for gas * price + value"
→ Get more SOPH tokens from the testnet faucet

#### "Internal error" or "no available server"
→ RPC is overloaded. Try:
- Increase `BATCH_DELAY_MS`
- Decrease `BATCH_SIZE`
- Reduce `TOTAL_DEPLOYMENTS`

#### "Stack too deep" compilation error
→ Enable `viaIR: true` in `hardhat.config.ts` (already configured)

#### "Cyclic dependency validator" error
→ Trying to compile too many nested factories (>100-200 is difficult)

#### Transactions timeout during confirmation
→ Increase timeout in `waitForTransactionReceipt`:
```typescript
timeout: 120_000, // 2 minutes
```

### RPC Rate Limiting

If you hit rate limits:

1. **Reduce concurrency**:
   ```typescript
   const BATCH_SIZE = 25;        // Smaller batches
   const BATCH_DELAY_MS = 50;    // Longer delays
   ```

2. **Add exponential backoff** (already implemented in retries)

3. **Test in stages**:
   - Start with 100 transfers
   - Then 500 transfers
   - Then 1000 transfers
   - Then move to counter/factory100

## 📁 Project Structure

```
HH-SophonV2-Test/
├── contracts/
│   ├── Counter.sol              # Simple counter contract
│   ├── Counter.t.sol            # Foundry test
│   ├── FactoryChain.sol         # 10-factory chain
│   ├── FactoryChain100.sol      # 100-factory chain
├── scripts/
│   ├── rapid-deployment-stress-test.ts   # Main stress test ⭐
│   ├── deploy-factory-chain.ts           # Deploy 10-chain
│   ├── deploy-factory-chain-100.ts       # Deploy 100-chain
│   ├── view-events.ts                    # Decode events
│   ├── generate-factory100.ts            # Generate 100-chain
├── test/
│   ├── Counter.ts               # Basic Hardhat tests
│   ├── RpcEndpoints.ts          # RPC endpoint validation ⭐
├── hardhat.config.ts            # Network configuration
├── package.json                 # Dependencies
└── README.md                    # This file
```

## 🎯 Testing Strategies

### Strategy 1: RPC Throughput Test
```bash
# Use transfers to test pure RPC throughput
bun run scripts/rapid-deployment-stress-test.ts transfer
```

### Strategy 2: Contract Deployment Stress
```bash
# Test contract creation load
bun run scripts/rapid-deployment-stress-test.ts counter
```

### Strategy 3: Gas Limit Stress Test
```bash
# Deploy 100-factory chains to max out gas per block
# Compile with solx first:
HARDHAT_PROFILE=solx bunx hardhat compile
bun run scripts/rapid-deployment-stress-test.ts factory100
```

### Strategy 4: Single Transaction Complexity
```bash
# Single massive transaction
# Compile with solx first:
HARDHAT_PROFILE=solx bunx hardhat compile
bun run hardhat run scripts/deploy-factory-chain-100.ts --network sophon
```

## 📈 Performance Benchmarks

Typical results on Sophon Testnet (may vary):

| Test Type | TPS | Gas/TX | Success Rate | Inclusion Time |
|-----------|-----|--------|--------------|----------------|
| Transfer  | 50-100 | ~21k | >99% | 2-5s |
| Counter   | 20-40 | ~200k | >95% | 3-8s |
| Factory100 | 5-15 | ~15M | >90% | 10-30s |

*Results depend on network conditions and test parameters*

## 🤝 Contributing

This is a test project for stress testing the Sophon L2. Feel free to:
- Add new stress test strategies
- Optimize gas usage
- Improve error handling
- Create visualizations of results

## 📄 License

MIT

## 🔗 Resources

- [Sophon Documentation](https://docs.sophon.xyz)
- [Hardhat 3 Docs](https://hardhat.org/docs/getting-started)
- [Viem Documentation](https://viem.sh/)

---

**⚠️ Warning**: This is for testnet use only. Do not use these scripts on mainnet without proper review and testing.
