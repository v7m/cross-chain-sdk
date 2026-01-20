// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {CrossChainBridgeGetters} from "./CrossChainBridgeGetters.sol";
import {CrossChainBridgeMessages} from "./CrossChainBridgeMessages.sol";
import {BytesLib} from "wormhole-solidity-sdk/testing/helpers/BytesLib.sol";
import {IWormhole} from "wormhole-solidity-sdk/interfaces/IWormhole.sol";
import {ITokenBridge} from "wormhole-solidity-sdk/interfaces/ITokenBridge.sol";

/**
 * @title CrossChainBridge
 * @notice Cross-chain token bridge using Wormhole Token Bridge with custom payload
 * @dev Compatible with the Solana cross-chain-bridge program
 */
contract CrossChainBridge is CrossChainBridgeGetters, CrossChainBridgeMessages {
    using BytesLib for bytes;

    event TokensSent(
        uint16 indexed targetChain,
        bytes32 indexed targetRecipient,
        uint256 amount,
        uint64 sequence
    );

    event TokensRedeemed(
        uint16 indexed sourceChain,
        bytes32 indexed sourceEmitter,
        address indexed recipient,
        address token,
        uint256 amount
    );

    event EmitterRegistered(uint16 indexed chainId, bytes32 emitterAddress);

    constructor(
        address wormhole_,
        address tokenBridge_,
        uint16 chainId_,
        uint8 wormholeFinality_
    ) {
        require(wormhole_ != address(0), "invalid Wormhole address");
        require(tokenBridge_ != address(0), "invalid TokenBridge address");
        require(chainId_ > 0, "invalid chainId");
        require(wormholeFinality_ > 0, "invalid wormholeFinality");

        setOwner(msg.sender);
        setWormhole(wormhole_);
        setTokenBridge(tokenBridge_);
        setChainId(chainId_);
        setWormholeFinality(wormholeFinality_);
    }

    /**
     * @dev Automatically handles both native (lock) and wrapped (burn) tokens
     */
    function sendTokensWithPayload(
        address token,
        uint256 amount,
        uint16 targetChain,
        bytes32 targetRecipient,
        uint32 batchId
    ) public payable returns (uint64 sequence) {
        require(amount > 0, "amount must be greater than 0");
        require(targetRecipient != bytes32(0), "invalid recipient");

        bytes32 targetContract = getRegisteredEmitter(targetChain);
        require(targetContract != bytes32(0), "target chain not registered");

        ITokenBridge bridge = tokenBridge();
        uint256 wormholeFee = wormhole().messageFee();
        require(msg.value >= wormholeFee, "insufficient fee");

        _safeTransferFrom(token, msg.sender, address(this), amount);
        IERC20(token).approve(address(bridge), amount);

        bytes memory payload = encodePayload(CrossChainPayload({
            payloadId: 1,
            recipient: targetRecipient
        }));

        sequence = bridge.transferTokensWithPayload{value: wormholeFee}(
            token,
            amount,
            targetChain,
            targetContract,
            batchId,
            payload
        );

        emit TokensSent(targetChain, targetRecipient, amount, sequence);
    }

    /**
     * @dev Automatically handles both native (unlock) and wrapped (mint) tokens
     */
    function redeemTokensWithPayload(bytes memory encodedVaa) public {
        (IWormhole.VM memory vm, bool valid, string memory reason) = wormhole().parseAndVerifyVM(encodedVaa);
        require(valid, reason);

        require(verifyEmitter(vm), "unknown emitter");
        require(!isTransferRedeemed(vm.hash), "transfer already redeemed");

        ITokenBridge bridge = tokenBridge();
        bytes memory transferPayload = bridge.completeTransferWithPayload(encodedVaa);

        ITokenBridge.TransferWithPayload memory transfer = bridge.parseTransferWithPayload(transferPayload);

        CrossChainPayload memory payload = decodePayload(transfer.payload);
        require(payload.payloadId == 1, "invalid payload ID");

        address recipient = _truncateAddress(payload.recipient);
        address tokenAddress = _getLocalTokenAddress(transfer);
        uint256 amount = _denormalizeAmount(transfer.amount, tokenAddress);

        setTransferRedeemed(vm.hash);

        _safeTransfer(tokenAddress, recipient, amount);

        emit TokensRedeemed(
            vm.emitterChainId,
            vm.emitterAddress,
            recipient,
            tokenAddress,
            amount
        );
    }

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

    function updateRelayerFee(
        uint32 relayerFee_,
        uint32 relayerFeePrecision_
    ) external onlyOwner {
        require(relayerFeePrecision_ > 0, "precision must be > 0");
        require(relayerFee_ < relayerFeePrecision_, "fee must be < precision");

        setRelayerFee(relayerFee_);
        setRelayerFeePrecision(relayerFeePrecision_);
    }

    function verifyEmitter(IWormhole.VM memory vm) internal view returns (bool) {
        return getRegisteredEmitter(vm.emitterChainId) == vm.emitterAddress;
    }

    function _truncateAddress(bytes32 addressBytes) internal pure returns (address) {
        return address(uint160(uint256(addressBytes)));
    }

    function _getLocalTokenAddress(
        ITokenBridge.TransferWithPayload memory transfer
    ) internal view returns (address) {
        if (transfer.tokenChain == chainId()) {
            return _truncateAddress(transfer.tokenAddress);
        } else {
            return tokenBridge().wrappedAsset(transfer.tokenChain, transfer.tokenAddress);
        }
    }

    function _denormalizeAmount(
        uint256 amount,
        address token
    ) internal view returns (uint256) {
        uint8 decimals = IERC20Metadata(token).decimals();
        if (decimals > 8) {
            amount *= 10 ** (decimals - 8);
        }
        return amount;
    }

    function _safeTransfer(address token, address to, uint256 amount) internal {
        bool success = IERC20(token).transfer(to, amount);
        require(success, "transfer failed");
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        bool success = IERC20(token).transferFrom(from, to, amount);
        require(success, "transferFrom failed");
    }

    modifier onlyOwner() {
        require(owner() == msg.sender, "caller not the owner");
        _;
    }
}

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IERC20Metadata is IERC20 {
    function decimals() external view returns (uint8);
}
