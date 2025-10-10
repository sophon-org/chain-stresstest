import "dotenv/config";
import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable } from "hardhat/config";
import { defineChain } from "viem";
import { homedir } from "os";
import { join } from "path";

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
      url: "https://block-explorer.zksync-os-testnet-sophon.zksync.dev/",
    },
  },
});

const config = {
  plugins: [hardhatToolboxViemPlugin],
  viem: {
    chains: [sophonTestnet],
  },
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
        path: join(homedir(), "solx-linux-amd64-gnu-v0.1.2"),
      },
      solc: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      },
      
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
    sophon: {
      type: "http",
      url: "https://zksync-os-testnet-sophon.zksync.dev",
      chainId: 531050204,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};

export default config;
