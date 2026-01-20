// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {CrossChainBridge} from "../src/CrossChainBridge/CrossChainBridge.sol";
import {CrossChainBridgeMessages} from "../src/CrossChainBridge/CrossChainBridgeMessages.sol";
import {CrossChainBridgeStructs} from "../src/CrossChainBridge/CrossChainBridgeStructs.sol";

contract CrossChainBridgeTest is Test {
    CrossChainBridge public bridge;
    CrossChainBridgeMessages public messages;

    address public owner = address(this);
    address public wormhole = makeAddr("wormhole");
    address public tokenBridge = makeAddr("tokenBridge");
    uint16 public chainId = 2; // Ethereum
    uint8 public wormholeFinality = 1;

    function setUp() public {
        bridge = new CrossChainBridge(
            wormhole,
            tokenBridge,
            chainId,
            wormholeFinality
        );
        messages = new CrossChainBridgeMessages();
    }

    function test_Constructor() public view {
        assertEq(bridge.owner(), owner);
        assertEq(address(bridge.wormhole()), wormhole);
        assertEq(address(bridge.tokenBridge()), tokenBridge);
        assertEq(bridge.chainId(), chainId);
        assertEq(bridge.wormholeFinality(), wormholeFinality);
    }

    function test_RegisterEmitter() public {
        uint16 foreignChainId = 1; // Solana
        bytes32 emitterAddress = bytes32(uint256(0x1234));

        bridge.registerEmitter(foreignChainId, emitterAddress);

        assertEq(bridge.getRegisteredEmitter(foreignChainId), emitterAddress);
    }

    function test_RegisterEmitter_RevertIfNotOwner() public {
        address notOwner = makeAddr("notOwner");
        uint16 foreignChainId = 1;
        bytes32 emitterAddress = bytes32(uint256(0x1234));

        vm.prank(notOwner);
        vm.expectRevert("caller not the owner");
        bridge.registerEmitter(foreignChainId, emitterAddress);
    }

    function test_RegisterEmitter_RevertIfSameChain() public {
        bytes32 emitterAddress = bytes32(uint256(0x1234));

        vm.expectRevert("invalid emitterChainId");
        bridge.registerEmitter(chainId, emitterAddress);
    }

    function test_RegisterEmitter_RevertIfZeroChain() public {
        bytes32 emitterAddress = bytes32(uint256(0x1234));

        vm.expectRevert("invalid emitterChainId");
        bridge.registerEmitter(0, emitterAddress);
    }

    function test_RegisterEmitter_RevertIfZeroAddress() public {
        uint16 foreignChainId = 1;

        vm.expectRevert("invalid emitterAddress");
        bridge.registerEmitter(foreignChainId, bytes32(0));
    }

    function test_UpdateRelayerFee() public {
        uint32 fee = 100;
        uint32 precision = 10000;

        bridge.updateRelayerFee(fee, precision);

        assertEq(bridge.relayerFee(), fee);
        assertEq(bridge.relayerFeePrecision(), precision);
    }

    function test_UpdateRelayerFee_RevertIfNotOwner() public {
        address notOwner = makeAddr("notOwner");

        vm.prank(notOwner);
        vm.expectRevert("caller not the owner");
        bridge.updateRelayerFee(100, 10000);
    }

    function test_EncodeDecodePayload() public view {
        CrossChainBridgeStructs.CrossChainPayload memory payload = CrossChainBridgeStructs.CrossChainPayload({
            payloadId: 1,
            recipient: bytes32(uint256(uint160(address(0x1234))))
        });

        bytes memory encoded = messages.encodePayload(payload);
        CrossChainBridgeStructs.CrossChainPayload memory decoded = messages.decodePayload(encoded);

        assertEq(decoded.payloadId, payload.payloadId);
        assertEq(decoded.recipient, payload.recipient);
    }

    function test_PayloadLength() public view {
        CrossChainBridgeStructs.CrossChainPayload memory payload = CrossChainBridgeStructs.CrossChainPayload({
            payloadId: 1,
            recipient: bytes32(uint256(uint160(address(0x1234))))
        });

        bytes memory encoded = messages.encodePayload(payload);
        assertEq(encoded.length, 33); // 1 byte payloadId + 32 bytes recipient
    }
}
