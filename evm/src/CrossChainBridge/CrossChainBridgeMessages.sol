// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {CrossChainBridgeStructs} from "./CrossChainBridgeStructs.sol";
import {BytesLib} from "wormhole-solidity-sdk/testing/helpers/BytesLib.sol";

contract CrossChainBridgeMessages is CrossChainBridgeStructs {
    using BytesLib for bytes;

    /**
     * @dev Format: [payloadId (1 byte)][recipient (32 bytes)]
     */
    function encodePayload(
        CrossChainPayload memory payload
    ) public pure returns (bytes memory encoded) {
        encoded = abi.encodePacked(
            payload.payloadId,
            payload.recipient
        );
    }

    /**
     * @dev Expects format: [payloadId (1 byte)][recipient (32 bytes)]
     */
    function decodePayload(
        bytes memory encoded
    ) public pure returns (CrossChainPayload memory payload) {
        uint256 index = 0;

        payload.payloadId = encoded.toUint8(index);
        index += 1;

        payload.recipient = encoded.toBytes32(index);
        index += 32;

        require(index == encoded.length, "invalid payload length");
    }
}
