// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract CrossChainBridgeStructs {
    struct CrossChainPayload {
        uint8 payloadId;
        bytes32 recipient;
    }
}
