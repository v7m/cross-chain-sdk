// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {CrossChainMessengerGetters} from "./CrossChainMessengerGetters.sol";
import {CrossChainMessengerMessages} from "./CrossChainMessengerMessages.sol";
import {IWormhole} from "wormhole-solidity-sdk/interfaces/IWormhole.sol";

/**
 * @title CrossChainMessenger
 * @notice Cross-chain messaging using Wormhole Core (generic messaging)
 * @dev Sends and receives arbitrary payload data without token transfers
 */
contract CrossChainMessenger is CrossChainMessengerGetters, CrossChainMessengerMessages {
    event MessageSent(
        uint16 indexed targetChain,
        uint64 indexed sequence,
        bytes payload
    );

    event MessageReceived(
        uint16 indexed sourceChain,
        bytes32 indexed sourceEmitter,
        bytes payload
    );

    event EmitterRegistered(uint16 indexed chainId, bytes32 emitterAddress);

    constructor(
        address wormhole_,
        uint16 chainId_,
        uint8 wormholeFinality_
    ) {
        require(wormhole_ != address(0), "invalid Wormhole address");
        require(chainId_ > 0, "invalid chainId");
        require(wormholeFinality_ > 0, "invalid wormholeFinality");

        setOwner(msg.sender);
        setWormhole(wormhole_);
        setChainId(chainId_);
        setWormholeFinality(wormholeFinality_);
    }

    /**
     * @notice Send a message to another chain via Wormhole Core
     * @param payload Arbitrary data to send
     * @return sequence Wormhole message sequence number
     */
    function sendMessage(
        bytes memory payload
    ) public payable returns (uint64 sequence) {
        require(payload.length > 0, "empty payload");
        require(payload.length < type(uint16).max, "payload too large");

        IWormhole wh = wormhole();
        uint256 wormholeFee = wh.messageFee();
        require(msg.value >= wormholeFee, "insufficient fee");

        bytes memory encodedMessage = encodeMessage(
            MessengerPayload({payloadId: 1, payload: payload})
        );

        sequence = wh.publishMessage{value: wormholeFee}(
            0, // batchId (nonce)
            encodedMessage,
            wormholeFinality()
        );

        emit MessageSent(chainId(), sequence, payload);
    }

    /**
     * @notice Receive and verify a message from another chain
     * @param encodedVaa Verified Wormhole message (VAA)
     */
    function receiveMessage(bytes memory encodedVaa) public {
        (
            IWormhole.VM memory vm,
            bool valid,
            string memory reason
        ) = wormhole().parseAndVerifyVM(encodedVaa);

        require(valid, reason);
        require(verifyEmitter(vm), "unknown emitter");
        require(!isMessageConsumed(vm.hash), "message already consumed");

        MessengerPayload memory parsedMessage = decodeMessage(vm.payload);

        consumeMessage(vm.hash, parsedMessage.payload);

        emit MessageReceived(
            vm.emitterChainId,
            vm.emitterAddress,
            parsedMessage.payload
        );
    }

    /**
     * @notice Register a trusted emitter from another chain
     * @param emitterChainId Wormhole chain ID
     * @param emitterAddress 32-byte emitter address
     */
    function registerEmitter(
        uint16 emitterChainId,
        bytes32 emitterAddress
    ) external onlyOwner {
        require(
            emitterChainId != 0 && emitterChainId != chainId(),
            "invalid emitterChainId"
        );
        require(emitterAddress != bytes32(0), "invalid emitterAddress");

        setEmitter(emitterChainId, emitterAddress);

        emit EmitterRegistered(emitterChainId, emitterAddress);
    }

    function verifyEmitter(IWormhole.VM memory vm) internal view returns (bool) {
        return getRegisteredEmitter(vm.emitterChainId) == vm.emitterAddress;
    }

    modifier onlyOwner() {
        require(owner() == msg.sender, "caller not the owner");
        _;
    }
}
