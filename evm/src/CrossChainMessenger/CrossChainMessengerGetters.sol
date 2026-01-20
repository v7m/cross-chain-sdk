// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IWormhole} from "wormhole-solidity-sdk/interfaces/IWormhole.sol";
import {CrossChainMessengerSetters} from "./CrossChainMessengerSetters.sol";

contract CrossChainMessengerGetters is CrossChainMessengerSetters {
    function owner() public view returns (address) {
        return _state.owner;
    }

    function wormhole() public view returns (IWormhole) {
        return IWormhole(_state.wormhole);
    }

    function chainId() public view returns (uint16) {
        return _state.chainId;
    }

    function wormholeFinality() public view returns (uint8) {
        return _state.wormholeFinality;
    }

    function getRegisteredEmitter(uint16 emitterChainId_) public view returns (bytes32) {
        return _state.registeredEmitters[emitterChainId_];
    }

    function getReceivedMessage(bytes32 hash_) public view returns (bytes memory) {
        return _state.receivedMessages[hash_];
    }

    function isMessageConsumed(bytes32 hash_) public view returns (bool) {
        return _state.consumedMessages[hash_];
    }
}
