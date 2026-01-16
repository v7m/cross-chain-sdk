// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {CrossChainBridge} from "../src/CrossChainBridge.sol";

contract DeployScript is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address wormhole = vm.envAddress("WORMHOLE_ADDRESS");
        address tokenBridge = vm.envAddress("TOKEN_BRIDGE_ADDRESS");
        uint16 chainId = uint16(vm.envUint("WORMHOLE_CHAIN_ID"));
        uint8 wormholeFinality = uint8(vm.envUint("WORMHOLE_FINALITY"));

        vm.startBroadcast(deployerPrivateKey);

        CrossChainBridge bridge = new CrossChainBridge(
            wormhole,
            tokenBridge,
            chainId,
            wormholeFinality
        );

        console.log("CrossChainBridge deployed at:", address(bridge));
        console.log("Owner:", bridge.owner());
        console.log("Chain ID:", bridge.chainId());

        vm.stopBroadcast();
    }
}
