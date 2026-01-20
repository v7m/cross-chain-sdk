use anchor_lang::prelude::*;
use wormhole_anchor_sdk::wormhole;

use crate::{context::RegisterEmitter, error::MessengerError};

pub fn handler(
    ctx: Context<RegisterEmitter>,
    chain: u16,
    address: [u8; 32],
) -> Result<()> {
    require!(
        chain > 0 && chain != wormhole::CHAIN_ID_SOLANA && !address.iter().all(|&x| x == 0),
        MessengerError::InvalidForeignEmitter,
    );

    let emitter = &mut ctx.accounts.foreign_emitter;
    emitter.chain = chain;
    emitter.address = address;

    msg!(
        "Foreign emitter registered: chain={}, address={:?}",
        chain,
        address
    );

    Ok(())
}
