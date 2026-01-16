use anchor_lang::prelude::*;
use wormhole_anchor_sdk::token_bridge;

use crate::{
    context::RedeemWrappedTransferWithPayload,
    error::BridgeError,
    message::TokenMessage,
    state::RedeemerConfig,
};

pub fn handler(
    ctx: Context<RedeemWrappedTransferWithPayload>,
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

    token_bridge::complete_transfer_wrapped_with_payload(CpiContext::new_with_signer(
        ctx.accounts.token_bridge_program.to_account_info(),
        token_bridge::CompleteTransferWrappedWithPayload {
            payer: ctx.accounts.payer.to_account_info(),
            config: ctx.accounts.token_bridge_config.to_account_info(),
            vaa: ctx.accounts.vaa.to_account_info(),
            claim: ctx.accounts.token_bridge_claim.to_account_info(),
            foreign_endpoint: ctx.accounts.token_bridge_foreign_endpoint.to_account_info(),
            to: ctx.accounts.tmp_token_account.to_account_info(),
            redeemer: ctx.accounts.config.to_account_info(),
            wrapped_mint: ctx.accounts.token_bridge_wrapped_mint.to_account_info(),
            wrapped_metadata: ctx.accounts.token_bridge_wrapped_meta.to_account_info(),
            mint_authority: ctx.accounts.token_bridge_mint_authority.to_account_info(),
            rent: ctx.accounts.rent.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
            wormhole_program: ctx.accounts.wormhole_program.to_account_info(),
        },
        &[&config_seeds[..]],
    ))?;

    let amount = ctx.accounts.vaa.data().amount();

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
            "RedeemWrappedTransferWithPayload :: relayed by {:?}",
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
