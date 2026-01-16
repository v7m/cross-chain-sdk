// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./CrossChainBridgeState.sol";

contract CrossChainBridgeSetters is CrossChainBridgeState {
    function setOwner(address owner_) internal {
        _state.owner = owner_;
    }

    function setWormhole(address wormhole_) internal {
        _state.wormhole = wormhole_;
    }

    function setTokenBridge(address tokenBridge_) internal {
        _state.tokenBridge = tokenBridge_;
    }

    function setChainId(uint16 chainId_) internal {
        _state.chainId = chainId_;
    }

    function setWormholeFinality(uint8 finality_) internal {
        _state.wormholeFinality = finality_;
    }

    function setRelayerFee(uint32 relayerFee_) internal {
        _state.relayerFee = relayerFee_;
    }

    function setRelayerFeePrecision(uint32 relayerFeePrecision_) internal {
        _state.relayerFeePrecision = relayerFeePrecision_;
    }

    function setEmitter(uint16 chainId_, bytes32 emitter_) internal {
        _state.registeredEmitters[chainId_] = emitter_;
    }

    function setTransferRedeemed(bytes32 hash_) internal {
        _state.redeemedTransfers[hash_] = true;
    }
}
