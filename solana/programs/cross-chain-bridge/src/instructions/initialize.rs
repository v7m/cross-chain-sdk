use anchor_lang::prelude::*;
use wormhole_anchor_sdk::wormhole;

use crate::{context::Initialize, error::BridgeError};

pub fn handler(
    ctx: Context<Initialize>,
    relayer_fee: u32,
    relayer_fee_precision: u32,
) -> Result<()> {
    require!(
        relayer_fee < relayer_fee_precision,
        BridgeError::InvalidRelayerFee,
    );

    let sender_config = &mut ctx.accounts.sender_config;
    sender_config.owner = ctx.accounts.owner.key();
    sender_config.bump = ctx.bumps.sender_config;
    sender_config.finality = wormhole::Finality::Finalized as u8;

    {
        let token_bridge = &mut sender_config.token_bridge;
        token_bridge.config = ctx.accounts.token_bridge_config.key();
        token_bridge.authority_signer = ctx.accounts.token_bridge_authority_signer.key();
        token_bridge.custody_signer = ctx.accounts.token_bridge_custody_signer.key();
        token_bridge.emitter = ctx.accounts.token_bridge_emitter.key();
        token_bridge.sequence = ctx.accounts.token_bridge_sequence.key();
        token_bridge.wormhole_bridge = ctx.accounts.wormhole_bridge.key();
        token_bridge.wormhole_fee_collector = ctx.accounts.wormhole_fee_collector.key();
    }

    let redeemer_config = &mut ctx.accounts.redeemer_config;
    redeemer_config.owner = ctx.accounts.owner.key();
    redeemer_config.bump = ctx.bumps.redeemer_config;
    redeemer_config.relayer_fee = relayer_fee;
    redeemer_config.relayer_fee_precision = relayer_fee_precision;

    {
        let token_bridge = &mut redeemer_config.token_bridge;
        token_bridge.config = ctx.accounts.token_bridge_config.key();
        token_bridge.custody_signer = ctx.accounts.token_bridge_custody_signer.key();
        token_bridge.mint_authority = ctx.accounts.token_bridge_mint_authority.key();
    }

    msg!(
        "Bridge initialized with relayer fee: {}/{}",
        relayer_fee,
        relayer_fee_precision
    );

    Ok(())
}
