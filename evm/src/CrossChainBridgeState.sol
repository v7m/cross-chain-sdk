// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract CrossChainBridgeStorage {
    struct State {
        address owner;
        address wormhole;
        address tokenBridge;
        uint16 chainId;
        uint8 wormholeFinality;
        uint32 relayerFee;
        uint32 relayerFeePrecision;
        mapping(uint16 => bytes32) registeredEmitters;
        mapping(bytes32 => bool) redeemedTransfers;
    }
}

contract CrossChainBridgeState {
    CrossChainBridgeStorage.State _state;
}
