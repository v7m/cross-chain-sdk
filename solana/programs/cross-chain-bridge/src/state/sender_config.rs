use anchor_lang::prelude::*;
use wormhole_anchor_sdk::token_bridge;

/// Addresses of Token Bridge accounts needed for outbound transfers.
#[derive(Default, AnchorSerialize, AnchorDeserialize, Copy, Clone, PartialEq, Eq)]
pub struct OutboundTokenBridgeAddresses {
    pub config: Pubkey,
    pub authority_signer: Pubkey,
    pub custody_signer: Pubkey,
    pub emitter: Pubkey,
    pub sequence: Pubkey,
    pub wormhole_bridge: Pubkey,
    pub wormhole_fee_collector: Pubkey,
}

impl OutboundTokenBridgeAddresses {
    pub const LEN: usize = 32 * 7; // 7 Pubkeys
}

/// Config account for sending tokens. Stores Token Bridge addresses
/// and program owner for authorization.
#[account]
#[derive(Default)]
pub struct SenderConfig {
    /// Program's owner.
    pub owner: Pubkey,
    /// PDA bump.
    pub bump: u8,
    /// Token Bridge program's relevant addresses.
    pub token_bridge: OutboundTokenBridgeAddresses,
    /// Consistency level (finality).
    pub finality: u8,
}

impl SenderConfig {
    pub const MAXIMUM_SIZE: usize = 8  // discriminator
        + 32  // owner
        + 1   // bump
        + OutboundTokenBridgeAddresses::LEN
        + 1;  // finality

    /// Seed prefix for PDA derivation - "sender"
    pub const SEED_PREFIX: &'static [u8; 6] = token_bridge::SEED_PREFIX_SENDER;
}
