// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {BytesLib} from "wormhole-solidity-sdk/testing/helpers/BytesLib.sol";
import {CrossChainMessengerStructs} from "./CrossChainMessengerStructs.sol";

contract CrossChainMessengerMessages is CrossChainMessengerStructs {
    using BytesLib for bytes;

    function encodeMessage(
        MessengerPayload memory parsedMessage
    ) public pure returns (bytes memory encodedMessage) {
        encodedMessage = abi.encodePacked(
            parsedMessage.payloadId,
            uint16(parsedMessage.payload.length),
            parsedMessage.payload
        );
    }

    function decodeMessage(
        bytes memory encodedMessage
    ) public pure returns (MessengerPayload memory parsedMessage) {
        uint256 index = 0;

        parsedMessage.payloadId = encodedMessage.toUint8(index);
        require(parsedMessage.payloadId == 1, "invalid payloadId");
        index += 1;

        uint256 payloadLength = encodedMessage.toUint16(index);
        index += 2;

        parsedMessage.payload = encodedMessage.slice(index, payloadLength);
        index += payloadLength;

        require(index == encodedMessage.length, "invalid message length");
    }
}
