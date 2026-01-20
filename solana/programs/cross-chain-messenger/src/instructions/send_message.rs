use anchor_lang::prelude::*;
use anchor_lang::solana_program;
use wormhole_anchor_sdk::wormhole;

use crate::{
    context::{SendMessage, SEED_PREFIX_SENT},
    message::MessengerMessage,
};

pub fn handler(ctx: Context<SendMessage>, payload: Vec<u8>) -> Result<()> {
    let fee = ctx.accounts.wormhole_bridge.fee();
    if fee > 0 {
        solana_program::program::invoke(
            &solana_program::system_instruction::transfer(
                &ctx.accounts.payer.key(),
                &ctx.accounts.wormhole_fee_collector.key(),
                fee,
            ),
            &ctx.accounts.to_account_infos(),
        )?;
    }

    let wormhole_emitter = &ctx.accounts.wormhole_emitter;
    let config = &ctx.accounts.config;

    let encoded_payload: Vec<u8> = MessengerMessage::Message { payload }.try_to_vec()?;

    wormhole::post_message(
        CpiContext::new_with_signer(
            ctx.accounts.wormhole_program.to_account_info(),
            wormhole::PostMessage {
                config: ctx.accounts.wormhole_bridge.to_account_info(),
                message: ctx.accounts.wormhole_message.to_account_info(),
                emitter: wormhole_emitter.to_account_info(),
                sequence: ctx.accounts.wormhole_sequence.to_account_info(),
                payer: ctx.accounts.payer.to_account_info(),
                fee_collector: ctx.accounts.wormhole_fee_collector.to_account_info(),
                clock: ctx.accounts.clock.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
            },
            &[
                &[
                    SEED_PREFIX_SENT,
                    &ctx.accounts.wormhole_sequence.next_value().to_le_bytes()[..],
                    &[ctx.bumps.wormhole_message],
                ],
                &[wormhole::SEED_PREFIX_EMITTER, &[wormhole_emitter.bump]],
            ],
        ),
        config.batch_id,
        encoded_payload,
        config.finality.try_into().unwrap(),
    )?;

    msg!("Message sent via Wormhole");

    Ok(())
}
