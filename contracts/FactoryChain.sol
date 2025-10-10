// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

// Factory10 - The final contract in the chain
contract Factory10 {
    uint256 public factoryNumber = 10;
    uint256 public deploymentTime;
    
    constructor() {
        deploymentTime = block.timestamp;
    }
    
    function getInfo() public view returns (uint256, uint256) {
        return (factoryNumber, deploymentTime);
    }
}

// Factory9 - Deploys Factory10
contract Factory9 {
    uint256 public factoryNumber = 9;
    uint256 public deploymentTime;
    address public deployedContract;
    
    event ContractDeployed(uint256 indexed factoryNumber, address indexed deployedAddress, uint256 nextFactoryNumber);
    
    constructor() {
        deploymentTime = block.timestamp;
        Factory10 factory10 = new Factory10();
        deployedContract = address(factory10);
        emit ContractDeployed(factoryNumber, deployedContract, 10);
    }
    
    function getInfo() public view returns (uint256, uint256, address) {
        return (factoryNumber, deploymentTime, deployedContract);
    }
}

// Factory8 - Deploys Factory9
contract Factory8 {
    uint256 public factoryNumber = 8;
    uint256 public deploymentTime;
    address public deployedContract;
    
    event ContractDeployed(uint256 indexed factoryNumber, address indexed deployedAddress, uint256 nextFactoryNumber);
    
    constructor() {
        deploymentTime = block.timestamp;
        Factory9 factory9 = new Factory9();
        deployedContract = address(factory9);
        emit ContractDeployed(factoryNumber, deployedContract, 9);
    }
    
    function getInfo() public view returns (uint256, uint256, address) {
        return (factoryNumber, deploymentTime, deployedContract);
    }
}

// Factory7 - Deploys Factory8
contract Factory7 {
    uint256 public factoryNumber = 7;
    uint256 public deploymentTime;
    address public deployedContract;
    
    event ContractDeployed(uint256 indexed factoryNumber, address indexed deployedAddress, uint256 nextFactoryNumber);
    
    constructor() {
        deploymentTime = block.timestamp;
        Factory8 factory8 = new Factory8();
        deployedContract = address(factory8);
        emit ContractDeployed(factoryNumber, deployedContract, 8);
    }
    
    function getInfo() public view returns (uint256, uint256, address) {
        return (factoryNumber, deploymentTime, deployedContract);
    }
}

// Factory6 - Deploys Factory7
contract Factory6 {
    uint256 public factoryNumber = 6;
    uint256 public deploymentTime;
    address public deployedContract;
    
    event ContractDeployed(uint256 indexed factoryNumber, address indexed deployedAddress, uint256 nextFactoryNumber);
    
    constructor() {
        deploymentTime = block.timestamp;
        Factory7 factory7 = new Factory7();
        deployedContract = address(factory7);
        emit ContractDeployed(factoryNumber, deployedContract, 7);
    }
    
    function getInfo() public view returns (uint256, uint256, address) {
        return (factoryNumber, deploymentTime, deployedContract);
    }
}

// Factory5 - Deploys Factory6
contract Factory5 {
    uint256 public factoryNumber = 5;
    uint256 public deploymentTime;
    address public deployedContract;
    
    event ContractDeployed(uint256 indexed factoryNumber, address indexed deployedAddress, uint256 nextFactoryNumber);
    
    constructor() {
        deploymentTime = block.timestamp;
        Factory6 factory6 = new Factory6();
        deployedContract = address(factory6);
        emit ContractDeployed(factoryNumber, deployedContract, 6);
    }
    
    function getInfo() public view returns (uint256, uint256, address) {
        return (factoryNumber, deploymentTime, deployedContract);
    }
}

// Factory4 - Deploys Factory5
contract Factory4 {
    uint256 public factoryNumber = 4;
    uint256 public deploymentTime;
    address public deployedContract;
    
    event ContractDeployed(uint256 indexed factoryNumber, address indexed deployedAddress, uint256 nextFactoryNumber);
    
    constructor() {
        deploymentTime = block.timestamp;
        Factory5 factory5 = new Factory5();
        deployedContract = address(factory5);
        emit ContractDeployed(factoryNumber, deployedContract, 5);
    }
    
    function getInfo() public view returns (uint256, uint256, address) {
        return (factoryNumber, deploymentTime, deployedContract);
    }
}

// Factory3 - Deploys Factory4
contract Factory3 {
    uint256 public factoryNumber = 3;
    uint256 public deploymentTime;
    address public deployedContract;
    
    event ContractDeployed(uint256 indexed factoryNumber, address indexed deployedAddress, uint256 nextFactoryNumber);
    
    constructor() {
        deploymentTime = block.timestamp;
        Factory4 factory4 = new Factory4();
        deployedContract = address(factory4);
        emit ContractDeployed(factoryNumber, deployedContract, 4);
    }
    
    function getInfo() public view returns (uint256, uint256, address) {
        return (factoryNumber, deploymentTime, deployedContract);
    }
}

// Factory2 - Deploys Factory3
contract Factory2 {
    uint256 public factoryNumber = 2;
    uint256 public deploymentTime;
    address public deployedContract;
    
    event ContractDeployed(uint256 indexed factoryNumber, address indexed deployedAddress, uint256 nextFactoryNumber);
    
    constructor() {
        deploymentTime = block.timestamp;
        Factory3 factory3 = new Factory3();
        deployedContract = address(factory3);
        emit ContractDeployed(factoryNumber, deployedContract, 3);
    }
    
    function getInfo() public view returns (uint256, uint256, address) {
        return (factoryNumber, deploymentTime, deployedContract);
    }
}

// Factory1 - The root factory that starts the chain
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
    function getAllAddresses() public view returns (address[10] memory) {
        address[10] memory addresses;
        addresses[0] = address(this);
        
        Factory2 f2 = Factory2(deployedContract);
        addresses[1] = address(f2);
        
        Factory3 f3 = Factory3(f2.deployedContract());
        addresses[2] = address(f3);
        
        Factory4 f4 = Factory4(f3.deployedContract());
        addresses[3] = address(f4);
        
        Factory5 f5 = Factory5(f4.deployedContract());
        addresses[4] = address(f5);
        
        Factory6 f6 = Factory6(f5.deployedContract());
        addresses[5] = address(f6);
        
        Factory7 f7 = Factory7(f6.deployedContract());
        addresses[6] = address(f7);
        
        Factory8 f8 = Factory8(f7.deployedContract());
        addresses[7] = address(f8);
        
        Factory9 f9 = Factory9(f8.deployedContract());
        addresses[8] = address(f9);
        
        Factory10 f10 = Factory10(f9.deployedContract());
        addresses[9] = address(f10);
        
        return addresses;
    }
}

