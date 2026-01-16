use anchor_lang::prelude::*;
use wormhole_anchor_sdk::token_bridge;

/// Addresses of Token Bridge accounts needed for inbound transfers.
#[derive(Default, AnchorSerialize, AnchorDeserialize, Copy, Clone, PartialEq, Eq)]
pub struct InboundTokenBridgeAddresses {
    pub config: Pubkey,
    pub custody_signer: Pubkey,
    pub mint_authority: Pubkey,
}

impl InboundTokenBridgeAddresses {
    pub const LEN: usize = 32 * 3; // 3 Pubkeys
}

/// Config account for redeeming tokens. Stores Token Bridge addresses,
/// relayer fee configuration, and program owner for authorization.
#[account]
#[derive(Default)]
pub struct RedeemerConfig {
    /// Program's owner.
    pub owner: Pubkey,
    /// PDA bump.
    pub bump: u8,
    /// Token Bridge program's relevant addresses.
    pub token_bridge: InboundTokenBridgeAddresses,
    /// Relayer fee numerator.
    pub relayer_fee: u32,
    /// Relayer fee denominator (precision).
    pub relayer_fee_precision: u32,
}

impl RedeemerConfig {
    pub const MAXIMUM_SIZE: usize = 8  // discriminator
        + 32  // owner
        + 1   // bump
        + InboundTokenBridgeAddresses::LEN
        + 4   // relayer_fee
        + 4;  // relayer_fee_precision

    /// Seed prefix for PDA derivation - "redeemer"
    pub const SEED_PREFIX: &'static [u8; 8] = token_bridge::SEED_PREFIX_REDEEMER;

    /// Calculate relayer fee amount from transfer amount.
    pub fn compute_relayer_amount(&self, amount: u64) -> u64 {
        (amount * self.relayer_fee as u64) / self.relayer_fee_precision as u64
    }
}
