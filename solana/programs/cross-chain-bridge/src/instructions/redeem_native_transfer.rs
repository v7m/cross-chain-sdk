use anchor_lang::prelude::*;
use wormhole_anchor_sdk::token_bridge;

use crate::{
    context::RedeemNativeTransferWithPayload,
    error::BridgeError,
    message::TokenMessage,
    state::RedeemerConfig,
};

pub fn handler(
    ctx: Context<RedeemNativeTransferWithPayload>,
    _vaa_hash: [u8; 32],
) -> Result<()> {
    require!(
        ctx.accounts.token_bridge_claim.data_is_empty(),
        BridgeError::AlreadyRedeemed
    );

    let TokenMessage::Hello { recipient } = ctx.accounts.vaa.message().data();
    require!(
        ctx.accounts.recipient.key().to_bytes() == *recipient,
        BridgeError::InvalidRecipient
    );

    let config_seeds = &[
        RedeemerConfig::SEED_PREFIX.as_ref(),
        &[ctx.accounts.config.bump],
    ];

    token_bridge::complete_transfer_native_with_payload(CpiContext::new_with_signer(
        ctx.accounts.token_bridge_program.to_account_info(),
        token_bridge::CompleteTransferNativeWithPayload {
            payer: ctx.accounts.payer.to_account_info(),
            config: ctx.accounts.token_bridge_config.to_account_info(),
            vaa: ctx.accounts.vaa.to_account_info(),
            claim: ctx.accounts.token_bridge_claim.to_account_info(),
            foreign_endpoint: ctx.accounts.token_bridge_foreign_endpoint.to_account_info(),
            to: ctx.accounts.tmp_token_account.to_account_info(),
            redeemer: ctx.accounts.config.to_account_info(),
            custody: ctx.accounts.token_bridge_custody.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            custody_signer: ctx.accounts.token_bridge_custody_signer.to_account_info(),
            rent: ctx.accounts.rent.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
            wormhole_program: ctx.accounts.wormhole_program.to_account_info(),
        },
        &[&config_seeds[..]],
    ))?;

    let amount = token_bridge::denormalize_amount(
        ctx.accounts.vaa.data().amount(),
        ctx.accounts.mint.decimals,
    );

    // Handle relayer fee if payer != recipient
    if ctx.accounts.payer.key() != ctx.accounts.recipient.key() {
        require!(
            !ctx.accounts.payer_token_account.data_is_empty(),
            BridgeError::NonExistentRelayerAta
        );

        let relayer_amount = ctx.accounts.config.compute_relayer_amount(amount);

        if relayer_amount > 0 {
            anchor_spl::token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    anchor_spl::token::Transfer {
                        from: ctx.accounts.tmp_token_account.to_account_info(),
                        to: ctx.accounts.payer_token_account.to_account_info(),
                        authority: ctx.accounts.config.to_account_info(),
                    },
                    &[&config_seeds[..]],
                ),
                relayer_amount,
            )?;
        }

        msg!(
            "RedeemNativeTransferWithPayload :: relayed by {:?}",
            ctx.accounts.payer.key()
        );

        anchor_spl::token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::Transfer {
                    from: ctx.accounts.tmp_token_account.to_account_info(),
                    to: ctx.accounts.recipient_token_account.to_account_info(),
                    authority: ctx.accounts.config.to_account_info(),
                },
                &[&config_seeds[..]],
            ),
            amount - relayer_amount,
        )?;
    } else {
        anchor_spl::token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::Transfer {
                    from: ctx.accounts.tmp_token_account.to_account_info(),
                    to: ctx.accounts.recipient_token_account.to_account_info(),
                    authority: ctx.accounts.config.to_account_info(),
                },
                &[&config_seeds[..]],
            ),
            amount,
        )?;
    }

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
