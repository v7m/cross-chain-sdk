use anchor_lang::prelude::*;

#[allow(unused_imports)]
use crate::ID;

#[derive(Default, AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct WormholeAddresses {
    pub bridge: Pubkey,
    pub fee_collector: Pubkey,
    pub sequence: Pubkey,
}

impl WormholeAddresses {
    pub const LEN: usize = 32 + 32 + 32;
}

#[account]
#[derive(Default)]
pub struct Config {
    pub owner: Pubkey,
    pub wormhole: WormholeAddresses,
    pub batch_id: u32,
    pub finality: u8,
}

impl Config {
    pub const MAXIMUM_SIZE: usize = 8 // discriminator
        + 32 // owner
        + WormholeAddresses::LEN
        + 4 // batch_id
        + 1 // finality
    ;
    pub const SEED_PREFIX: &'static [u8; 6] = b"config";
}
