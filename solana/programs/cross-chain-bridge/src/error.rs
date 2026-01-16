use anchor_lang::prelude::*;

#[error_code]
pub enum BridgeError {
    #[msg("InvalidWormholeBridge")]
    InvalidWormholeBridge,

    #[msg("InvalidWormholeFeeCollector")]
    InvalidWormholeFeeCollector,

    #[msg("InvalidWormholeEmitter")]
    InvalidWormholeEmitter,

    #[msg("InvalidWormholeSequence")]
    InvalidWormholeSequence,

    #[msg("OwnerOnly")]
    OwnerOnly,

    #[msg("InvalidForeignContract")]
    InvalidForeignContract,

    #[msg("ZeroBridgeAmount")]
    ZeroBridgeAmount,

    #[msg("InvalidTokenBridgeConfig")]
    InvalidTokenBridgeConfig,

    #[msg("InvalidTokenBridgeAuthoritySigner")]
    InvalidTokenBridgeAuthoritySigner,

    #[msg("InvalidTokenBridgeCustodySigner")]
    InvalidTokenBridgeCustodySigner,

    #[msg("InvalidTokenBridgeEmitter")]
    InvalidTokenBridgeEmitter,

    #[msg("InvalidTokenBridgeSequence")]
    InvalidTokenBridgeSequence,

    #[msg("InvalidRecipient")]
    InvalidRecipient,

    #[msg("InvalidTransferToChain")]
    InvalidTransferToChain,

    #[msg("InvalidTransferTokenChain")]
    InvalidTransferTokenChain,

    #[msg("InvalidRelayerFee")]
    InvalidRelayerFee,

    #[msg("InvalidPayerAta")]
    InvalidPayerAta,

    #[msg("InvalidTransferToAddress")]
    InvalidTransferToAddress,

    #[msg("AlreadyRedeemed")]
    AlreadyRedeemed,

    #[msg("InvalidTokenBridgeForeignEndpoint")]
    InvalidTokenBridgeForeignEndpoint,

    #[msg("NonExistentRelayerAta")]
    NonExistentRelayerAta,

    #[msg("InvalidTokenBridgeMintAuthority")]
    InvalidTokenBridgeMintAuthority,
}
