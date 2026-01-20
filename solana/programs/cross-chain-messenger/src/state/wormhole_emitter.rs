use anchor_lang::prelude::*;
use wormhole_anchor_sdk::wormhole;

#[allow(unused_imports)]
use crate::ID;

#[account]
#[derive(Default)]
pub struct WormholeEmitter {
    pub bump: u8,
}

impl WormholeEmitter {
    pub const MAXIMUM_SIZE: usize = 8 + 1;
    pub const SEED_PREFIX: &'static [u8; 7] = wormhole::SEED_PREFIX_EMITTER;
}
