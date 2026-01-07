# Factory Chain Stress Test

This stress test deploys 10 factory contracts in a single transaction, where each factory deploys the next one in its constructor.

## Architecture

```
Transaction → Deploy Factory1 → Factory1.constructor()
                                    ↓
                                 Deploy Factory2 → Factory2.constructor()
                                                       ↓
                                                    Deploy Factory3 → ...
                                                                        ↓
                                                                     Factory10
```

## Contracts

- **FactoryChain.sol**: Contains all 10 factory contracts (Factory1 through Factory10)
  - Factory1: The root factory, deploys Factory2
  - Factory2-9: Middle factories, each deploys the next
  - Factory10: The final factory, doesn't deploy anything
  - Each factory stores its number, deployment time, and the address of the contract it deployed

## Setup

1. **Set your private key** as an environment variable:
   ```bash
   export PRIVATE_KEY="your_private_key_here"
   ```

2. **Ensure you have testnet ETH** on the Sophon testnet at:
   - RPC: https://rpc.testnet.os.sophon.com

## Running the Stress Test

Deploy the factory chain with a single command:

```bash
bun run hardhat run scripts/deploy-factory-chain.ts --network sophon
```

## What the Script Does

1. **Connects** to the Sophon testnet
2. **Deploys Factory1** (which automatically triggers the deployment of all 10 factories)
3. **Verifies** all 10 contracts were deployed correctly
4. **Displays** detailed information:
   - All contract addresses
   - Factory numbers and deployment times
   - Transaction hash and gas usage
   - Total deployment cost

## Expected Output

```
🚀 Starting Factory Chain Deployment Stress Test
============================================================

📍 Network: sophon
🔑 Deployer Address: 0x...
💰 Deployer Balance: X.XX ETH
⛓️  Chain ID: XXXX

============================================================
⏳ Deploying Factory1 (which will deploy all 10 factories)...
============================================================

✅ Factory1 deployed successfully!
📋 Factory1 Address: 0x...
⏱️  Total Deployment Time: X.XXs

============================================================
🔍 Retrieving all deployed contract addresses...
============================================================

📦 All 10 Factory Contracts Deployed:
------------------------------------------------------------
   Factory1: 0x...
   Factory2: 0x...
   Factory3: 0x...
   ...
   Factory10: 0x...
------------------------------------------------------------

🔍 Verifying each contract...
------------------------------------------------------------
   ✓ Factory1 (0x...)
     - Factory Number: 1
     - Deployment Time: 2025-10-09T...
     - Deployed Contract: 0x...
   ...
------------------------------------------------------------

============================================================
📊 Transaction Statistics
============================================================
   Transaction Hash: 0x...
   Block Number: XXXXXX
   Gas Used: X,XXX,XXX
   Effective Gas Price: X.XX ETH
   Total Cost: ~X.XX ETH
   Status: ✅ Success

============================================================
🎉 STRESS TEST COMPLETED SUCCESSFULLY!
============================================================
   ✅ 10 Factory Contracts deployed in a single transaction
   ⏱️  Duration: X.XXs
   💰 Total Gas Used: X,XXX,XXX
============================================================
```

## Gas Estimation

Deploying 10 contracts in a single transaction will consume significant gas. The exact amount depends on:
- Contract bytecode size
- Constructor execution cost
- Network gas price

This is an excellent stress test for:
- Testing CREATE opcode limits
- Measuring transaction gas limits
- Testing nested contract deployments
- Evaluating network performance

## Interacting with Deployed Contracts

After deployment, you can interact with any factory contract using its address:

```typescript
const factory1 = await hardhat.viem.getContractAt("Factory1", "0x...");
const allAddresses = await factory1.read.getAllAddresses();
```

Or via command line:
```bash
bun run hardhat console --network sophon
```

## Network Configuration

The Sophon testnet is configured in `hardhat.config.ts`:

```typescript
sophon: {
  type: "http",
  chainType: "l2",
  url: "https://rpc.testnet.os.sophon.com",
  accounts: [configVariable("PRIVATE_KEY")],
}
```

## Troubleshooting

### "insufficient funds"
- Ensure your account has enough testnet ETH for gas fees

### "out of gas"
- The network may have a lower gas limit than expected
- Try deploying fewer factories or increase the gas limit

### "execution reverted"
- Check if the network supports nested CREATE operations
- Verify the network is EVM compatible

### "PRIVATE_KEY not set"
- Export your private key: `export PRIVATE_KEY="0x..."`

