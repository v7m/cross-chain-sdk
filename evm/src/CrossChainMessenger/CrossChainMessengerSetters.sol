// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {CrossChainMessengerState} from "./CrossChainMessengerState.sol";

contract CrossChainMessengerSetters is CrossChainMessengerState {
    function setOwner(address owner_) internal {
        _state.owner = owner_;
    }

    function setWormhole(address wormhole_) internal {
        _state.wormhole = payable(wormhole_);
    }

    function setChainId(uint16 chainId_) internal {
        _state.chainId = chainId_;
    }

    function setWormholeFinality(uint8 finality_) internal {
        _state.wormholeFinality = finality_;
    }

    function setEmitter(uint16 chainId_, bytes32 emitter_) internal {
        _state.registeredEmitters[chainId_] = emitter_;
    }

    function consumeMessage(bytes32 hash_, bytes memory payload_) internal {
        _state.receivedMessages[hash_] = payload_;
        _state.consumedMessages[hash_] = true;
    }
}
