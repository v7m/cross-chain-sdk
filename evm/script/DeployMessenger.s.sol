// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {CrossChainMessenger} from "../src/CrossChainMessenger/CrossChainMessenger.sol";

contract DeployMessengerScript is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address wormhole = vm.envAddress("WORMHOLE_ADDRESS");
        uint16 chainId = uint16(vm.envUint("WORMHOLE_CHAIN_ID"));
        uint8 wormholeFinality = uint8(vm.envUint("WORMHOLE_FINALITY"));

        vm.startBroadcast(deployerPrivateKey);

        CrossChainMessenger messenger = new CrossChainMessenger(
            wormhole,
            chainId,
            wormholeFinality
        );

        console.log("CrossChainMessenger deployed at:", address(messenger));
        console.log("Owner:", messenger.owner());
        console.log("Chain ID:", messenger.chainId());

        vm.stopBroadcast();
    }
}
