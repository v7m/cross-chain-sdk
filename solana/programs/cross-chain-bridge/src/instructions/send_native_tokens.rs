use anchor_lang::prelude::*;
use wormhole_anchor_sdk::{token_bridge, wormhole};

use crate::{
    context::{SendNativeTokensWithPayload, SEED_PREFIX_BRIDGED},
    error::BridgeError,
    message::TokenMessage,
    state::SenderConfig,
};

pub fn handler(
    ctx: Context<SendNativeTokensWithPayload>,
    batch_id: u32,
    amount: u64,
    recipient_address: [u8; 32],
    recipient_chain: u16,
) -> Result<()> {
    // Token Bridge truncates amounts to 8 decimals
    let truncated_amount = token_bridge::truncate_amount(amount, ctx.accounts.mint.decimals);
    require!(truncated_amount > 0, BridgeError::ZeroBridgeAmount);

    if truncated_amount != amount {
        msg!(
            "SendNativeTokensWithPayload :: truncating amount {} to {}",
            amount,
            truncated_amount
        );
    }

    require!(
        recipient_chain > 0
            && recipient_chain != wormhole::CHAIN_ID_SOLANA
            && !recipient_address.iter().all(|&x| x == 0),
        BridgeError::InvalidRecipient,
    );

    let config_seeds = &[
        SenderConfig::SEED_PREFIX.as_ref(),
        &[ctx.accounts.config.bump],
    ];

    anchor_spl::token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::Transfer {
                from: ctx.accounts.from_token_account.to_account_info(),
                to: ctx.accounts.tmp_token_account.to_account_info(),
                authority: ctx.accounts.payer.to_account_info(),
            },
        ),
        truncated_amount,
    )?;

    anchor_spl::token::approve(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::Approve {
                to: ctx.accounts.tmp_token_account.to_account_info(),
                delegate: ctx.accounts.token_bridge_authority_signer.to_account_info(),
                authority: ctx.accounts.config.to_account_info(),
            },
            &[&config_seeds[..]],
        ),
        truncated_amount,
    )?;

    let payload = TokenMessage::Hello {
        recipient: recipient_address,
    }
    .try_to_vec()?;

    token_bridge::transfer_native_with_payload(
        CpiContext::new_with_signer(
            ctx.accounts.token_bridge_program.to_account_info(),
            token_bridge::TransferNativeWithPayload {
                payer: ctx.accounts.payer.to_account_info(),
                config: ctx.accounts.token_bridge_config.to_account_info(),
                from: ctx.accounts.tmp_token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                custody: ctx.accounts.token_bridge_custody.to_account_info(),
                authority_signer: ctx.accounts.token_bridge_authority_signer.to_account_info(),
                custody_signer: ctx.accounts.token_bridge_custody_signer.to_account_info(),
                wormhole_bridge: ctx.accounts.wormhole_bridge.to_account_info(),
                wormhole_message: ctx.accounts.wormhole_message.to_account_info(),
                wormhole_emitter: ctx.accounts.token_bridge_emitter.to_account_info(),
                wormhole_sequence: ctx.accounts.token_bridge_sequence.to_account_info(),
                wormhole_fee_collector: ctx.accounts.wormhole_fee_collector.to_account_info(),
                clock: ctx.accounts.clock.to_account_info(),
                sender: ctx.accounts.config.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
                wormhole_program: ctx.accounts.wormhole_program.to_account_info(),
            },
            &[
                &config_seeds[..],
                &[
                    SEED_PREFIX_BRIDGED,
                    &ctx.accounts
                        .token_bridge_sequence
                        .next_value()
                        .to_le_bytes()[..],
                    &[ctx.bumps.wormhole_message],
                ],
            ],
        ),
        batch_id,
        truncated_amount,
        ctx.accounts.foreign_contract.address,
        recipient_chain,
        payload,
        &ctx.program_id.key(),
    )?;

    anchor_spl::token::close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        anchor_spl::token::CloseAccount {
            account: ctx.accounts.tmp_token_account.to_account_info(),
            destination: ctx.accounts.payer.to_account_info(),
            authority: ctx.accounts.config.to_account_info(),
        },
        &[&config_seeds[..]],
    ))
}
