# Sophon Testnet Stress Test Suite

Comprehensive stress testing tools for the Sophon EVM L2 testnet. This project includes multiple strategies for testing network performance, gas limits, and transaction throughput.

## 🌐 Network Details

- **Network**: Sophon Testnet (Fully EVM Compatible L2)
- **RPC URL**: https://zksync-os-testnet-sophon.zksync.dev
- **Chain ID**: 531050204
- **Block Explorer**: https://block-explorer.zksync-os-testnet-sophon.zksync.dev/
- **Native Currency**: SOPH (18 decimals)

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Stress Test Types](#stress-test-types)
3. [Factory Chain Contracts](#factory-chain-contracts)
4. [Usage Guide](#usage-guide)
5. [Results and Metrics](#results-and-metrics)
6. [Troubleshooting](#troubleshooting)

## 🚀 Quick Start

### Prerequisites

```bash
# Install dependencies
bun install

# Set your private key (account needs SOPH testnet tokens)
export PRIVATE_KEY="0x..."

# Compile contracts
bun run hardhat compile
```

### Run Your First Test

```bash
# Start with simple transfers (cheapest, fastest)
bun run scripts/rapid-deployment-stress-test.ts transfer

# Or deploy Counter contracts
bun run scripts/rapid-deployment-stress-test.ts counter

# Or go big with 100-Factory Chain deployments
bun run scripts/rapid-deployment-stress-test.ts factory100
```

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

Edit these constants in the script:

```typescript
const TOTAL_DEPLOYMENTS = 1000;  // Total transactions to send
const BATCH_SIZE = 50;           // Transactions per batch
const BATCH_DELAY_MS = 10;       // Delay between batches (ms)
```

#### Features

- ✅ **Manual Nonce Management** - No waiting for confirmations
- ✅ **Concurrent Submissions** - Sends transactions as fast as possible
- ✅ **Batching Control** - Prevents RPC overload
- ✅ **Failure Tracking** - Monitors submission and confirmation failures
- ✅ **Inclusion Time Metrics** - Tracks time from submission to confirmation
- ✅ **Detailed Error Logging** - Full RPC error response for debugging
- ✅ **JSON Report Export** - Saves comprehensive results

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
- **Compilation**: Requires `viaIR: true` optimizer setting
- **Gas Usage**: ~15-20M gas per deployment

## 📖 Usage Guide

### Setting Up

1. **Get Testnet Tokens**
   - Visit Sophon testnet faucet
   - Send SOPH to your test account

2. **Configure Environment**
   ```bash
   export PRIVATE_KEY="0xYOUR_PRIVATE_KEY"
   ```

3. **Compile Contracts**
   ```bash
   bun run hardhat compile
   ```

### Running Tests

#### Rapid Stress Test Examples

```bash
# Quick test: 100 transfers
# Edit TOTAL_DEPLOYMENTS to 100 in the script
bun run scripts/rapid-deployment-stress-test.ts transfer

# Medium test: 1000 Counter deployments
bun run scripts/rapid-deployment-stress-test.ts counter

# Maximum stress: 1000 x 100-Factory Chains = 100,000 contracts!
bun run scripts/rapid-deployment-stress-test.ts factory100
```

#### Single Chain Deployments

```bash
# 10-Factory Chain
bun run hardhat run scripts/deploy-factory-chain.ts --network sophon

# 100-Factory Chain  
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
- Gas usage per transaction
- Block numbers
- Error messages

## 🔧 Customization

### Modify Test Parameters

Edit `scripts/rapid-deployment-stress-test.ts`:

```typescript
// Test size
const TOTAL_DEPLOYMENTS = 1000;  // Increase for longer tests

// RPC settings (in client creation)
transport: http(undefined, {
  retryCount: 5,      // Number of retries on failure
  retryDelay: 1000,   // Delay between retries (ms)
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
bun run scripts/rapid-deployment-stress-test.ts factory100
```

### Strategy 4: Single Transaction Complexity
```bash
# Single massive transaction
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
