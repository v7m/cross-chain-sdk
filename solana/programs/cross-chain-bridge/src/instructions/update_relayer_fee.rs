use anchor_lang::prelude::*;

use crate::{context::UpdateRelayerFee, error::BridgeError};

pub fn handler(
    ctx: Context<UpdateRelayerFee>,
    relayer_fee: u32,
    relayer_fee_precision: u32,
) -> Result<()> {
    require!(
        relayer_fee < relayer_fee_precision,
        BridgeError::InvalidRelayerFee,
    );

    let config = &mut ctx.accounts.config;
    config.relayer_fee = relayer_fee;
    config.relayer_fee_precision = relayer_fee_precision;

    msg!(
        "Relayer fee updated: {}/{}",
        relayer_fee,
        relayer_fee_precision
    );

    Ok(())
}
