use anchor_lang::prelude::*;
use anchor_lang::solana_program;
use wormhole_anchor_sdk::wormhole;

use crate::{
    context::{Initialize, SEED_PREFIX_SENT},
    message::MessengerMessage,
};

pub fn handler(ctx: Context<Initialize>) -> Result<()> {
    let config = &mut ctx.accounts.config;

    config.owner = ctx.accounts.owner.key();

    {
        let wormhole = &mut config.wormhole;
        wormhole.bridge = ctx.accounts.wormhole_bridge.key();
        wormhole.fee_collector = ctx.accounts.wormhole_fee_collector.key();
        wormhole.sequence = ctx.accounts.wormhole_sequence.key();
    }

    config.batch_id = 0;
    config.finality = wormhole::Finality::Confirmed as u8;

    ctx.accounts.wormhole_emitter.bump = ctx.bumps.wormhole_emitter;

    {
        let fee = ctx.accounts.wormhole_bridge.fee();
        if fee > 0 {
            solana_program::program::invoke(
                &solana_program::system_instruction::transfer(
                    &ctx.accounts.owner.key(),
                    &ctx.accounts.wormhole_fee_collector.key(),
                    fee,
                ),
                &ctx.accounts.to_account_infos(),
            )?;
        }

        let wormhole_emitter = &ctx.accounts.wormhole_emitter;
        let config = &ctx.accounts.config;

        let mut payload: Vec<u8> = Vec::new();
        MessengerMessage::serialize(
            &MessengerMessage::Alive {
                program_id: *ctx.program_id,
            },
            &mut payload,
        )?;

        wormhole::post_message(
            CpiContext::new_with_signer(
                ctx.accounts.wormhole_program.to_account_info(),
                wormhole::PostMessage {
                    config: ctx.accounts.wormhole_bridge.to_account_info(),
                    message: ctx.accounts.wormhole_message.to_account_info(),
                    emitter: wormhole_emitter.to_account_info(),
                    sequence: ctx.accounts.wormhole_sequence.to_account_info(),
                    payer: ctx.accounts.owner.to_account_info(),
                    fee_collector: ctx.accounts.wormhole_fee_collector.to_account_info(),
                    clock: ctx.accounts.clock.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                },
                &[
                    &[
                        SEED_PREFIX_SENT,
                        &wormhole::INITIAL_SEQUENCE.to_le_bytes()[..],
                        &[ctx.bumps.wormhole_message],
                    ],
                    &[wormhole::SEED_PREFIX_EMITTER, &[wormhole_emitter.bump]],
                ],
            ),
            config.batch_id,
            payload,
            config.finality.try_into().unwrap(),
        )?;
    }

    msg!("Messenger initialized");

    Ok(())
}
