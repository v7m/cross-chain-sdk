// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract CrossChainMessengerStructs {
    struct MessengerPayload {
        uint8 payloadId;
        bytes payload;
    }
}
