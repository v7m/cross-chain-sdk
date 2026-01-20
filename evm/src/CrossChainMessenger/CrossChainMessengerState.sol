// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract CrossChainMessengerStorage {
    struct State {
        address owner;
        address wormhole;
        uint16 chainId;
        uint8 wormholeFinality;

        mapping(uint16 => bytes32) registeredEmitters;
        mapping(bytes32 => bytes) receivedMessages;
        mapping(bytes32 => bool) consumedMessages;
    }
}

contract CrossChainMessengerState {
    CrossChainMessengerStorage.State _state;
}
