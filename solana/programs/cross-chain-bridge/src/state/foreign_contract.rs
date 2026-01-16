use anchor_lang::prelude::*;

use crate::message::PostedTokenMessage;

/// Foreign contract account data. Stores information about trusted
/// contracts on other chains that can send/receive token transfers.
#[account]
#[derive(Default)]
pub struct ForeignContract {
    /// Emitter chain. Cannot equal 1 (Solana's Chain ID).
    pub chain: u16,
    /// Emitter address. Cannot be zero address.
    pub address: [u8; 32],
    /// Token Bridge program's foreign endpoint account key.
    pub token_bridge_foreign_endpoint: Pubkey,
}

impl ForeignContract {
    pub const MAXIMUM_SIZE: usize = 8  // discriminator
        + 2   // chain
        + 32  // address
        + 32; // token_bridge_foreign_endpoint

    /// Seed prefix for PDA derivation.
    pub const SEED_PREFIX: &'static [u8; 16] = b"foreign_contract";

    /// Verify that VAA comes from this registered foreign contract.
    pub fn verify(&self, vaa: &PostedTokenMessage) -> bool {
        vaa.emitter_chain() == self.chain && *vaa.data().from_address() == self.address
    }
}
