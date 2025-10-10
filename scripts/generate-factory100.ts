import { writeFileSync } from "fs";
import { join } from "path";

console.log("🏭 Generating FactoryChain100.sol...");

const totalFactories = 100;
let solidityCode = `// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

// Auto-generated chain of ${totalFactories} factory contracts
// Each factory deploys the next one in its constructor

`;

// Generate Factory100 (final contract, no deployment)
solidityCode += `// Factory${totalFactories} - The final contract in the chain
contract Factory${totalFactories} {
    uint256 public factoryNumber = ${totalFactories};
    uint256 public deploymentTime;
    
    constructor() {
        deploymentTime = block.timestamp;
    }
    
    function getInfo() public view returns (uint256, uint256) {
        return (factoryNumber, deploymentTime);
    }
}

`;

// Generate Factory99 down to Factory2
for (let i = totalFactories - 1; i >= 2; i--) {
    const nextFactory = i + 1;
    solidityCode += `// Factory${i} - Deploys Factory${nextFactory}
contract Factory${i} {
    uint256 public factoryNumber = ${i};
    uint256 public deploymentTime;
    address public deployedContract;
    
    event ContractDeployed(uint256 indexed factoryNumber, address indexed deployedAddress, uint256 nextFactoryNumber);
    
    constructor() {
        deploymentTime = block.timestamp;
        Factory${nextFactory} factory${nextFactory} = new Factory${nextFactory}();
        deployedContract = address(factory${nextFactory});
        emit ContractDeployed(factoryNumber, deployedContract, ${nextFactory});
    }
    
    function getInfo() public view returns (uint256, uint256, address) {
        return (factoryNumber, deploymentTime, deployedContract);
    }
}

`;
}

// Generate Factory1 with getAllAddresses function
solidityCode += `// Factory1 - The root factory that starts the chain
contract Factory1 {
    uint256 public factoryNumber = 1;
    uint256 public deploymentTime;
    address public deployedContract;
    
    event ContractDeployed(uint256 indexed factoryNumber, address indexed deployedAddress, uint256 nextFactoryNumber);
    
    constructor() {
        deploymentTime = block.timestamp;
        Factory2 factory2 = new Factory2();
        deployedContract = address(factory2);
        emit ContractDeployed(factoryNumber, deployedContract, 2);
    }
    
    function getInfo() public view returns (uint256, uint256, address) {
        return (factoryNumber, deploymentTime, deployedContract);
    }
    
    // Helper function to get all deployed contract addresses in the chain
    function getAllAddresses() public view returns (address[${totalFactories}] memory) {
        address[${totalFactories}] memory addresses;
        addresses[0] = address(this);
        
`;

// Generate the chain traversal code
for (let i = 2; i <= totalFactories; i++) {
    const prevIndex = i - 2;
    const currentIndex = i - 1;
    
    if (i === 2) {
        solidityCode += `        Factory2 f2 = Factory2(deployedContract);
        addresses[1] = address(f2);
        
`;
    } else {
        solidityCode += `        Factory${i} f${i} = Factory${i}(f${i - 1}.deployedContract());
        addresses[${currentIndex}] = address(f${i});
        
`;
    }
}

solidityCode += `        return addresses;
    }
}
`;

// Write to file
const outputPath = join(process.cwd(), "contracts/FactoryChain100.sol");
writeFileSync(outputPath, solidityCode);

console.log(`✅ Generated ${outputPath}`);
console.log(`   Total contracts: ${totalFactories}`);
console.log(`   File size: ${(solidityCode.length / 1024).toFixed(2)} KB`);
console.log(`   Lines of code: ${solidityCode.split('\n').length.toLocaleString()}`);

