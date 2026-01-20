use anchor_lang::prelude::*;

use crate::context::CloseReceived;

pub fn handler(_ctx: Context<CloseReceived>, _emitter_chain: u16, _sequence: u64) -> Result<()> {
    // Account closure is handled automatically by Anchor's close constraint
    msg!("Received account closed, rent returned to payer");
    Ok(())
}
