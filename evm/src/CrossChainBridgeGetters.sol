// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./CrossChainBridgeSetters.sol";
import {IWormhole} from "wormhole-solidity-sdk/interfaces/IWormhole.sol";
import {ITokenBridge} from "wormhole-solidity-sdk/interfaces/ITokenBridge.sol";

contract CrossChainBridgeGetters is CrossChainBridgeSetters {
    function owner() public view returns (address) {
        return _state.owner;
    }

    function wormhole() public view returns (IWormhole) {
        return IWormhole(_state.wormhole);
    }

    function tokenBridge() public view returns (ITokenBridge) {
        return ITokenBridge(_state.tokenBridge);
    }

    function chainId() public view returns (uint16) {
        return _state.chainId;
    }

    function wormholeFinality() public view returns (uint8) {
        return _state.wormholeFinality;
    }

    function relayerFee() public view returns (uint32) {
        return _state.relayerFee;
    }

    function relayerFeePrecision() public view returns (uint32) {
        return _state.relayerFeePrecision;
    }

    function getRegisteredEmitter(uint16 emitterChainId_) public view returns (bytes32) {
        return _state.registeredEmitters[emitterChainId_];
    }

    function isTransferRedeemed(bytes32 hash_) public view returns (bool) {
        return _state.redeemedTransfers[hash_];
    }
}
