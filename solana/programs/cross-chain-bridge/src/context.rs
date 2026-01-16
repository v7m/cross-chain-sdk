use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};
use wormhole_anchor_sdk::{
    token_bridge::{self, program::TokenBridge},
    wormhole::{self, program::Wormhole},
};

use crate::{
    error::BridgeError,
    message::PostedTokenMessage,
    state::{ForeignContract, RedeemerConfig, SenderConfig},
};

pub const SEED_PREFIX_BRIDGED: &[u8; 7] = b"bridged";
pub const SEED_PREFIX_TMP: &[u8; 3] = b"tmp";

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        seeds = [SenderConfig::SEED_PREFIX],
        bump,
        space = SenderConfig::MAXIMUM_SIZE,
    )]
    pub sender_config: Box<Account<'info, SenderConfig>>,

    #[account(
        init,
        payer = owner,
        seeds = [RedeemerConfig::SEED_PREFIX],
        bump,
        space = RedeemerConfig::MAXIMUM_SIZE,
    )]
    pub redeemer_config: Box<Account<'info, RedeemerConfig>>,

    pub wormhole_program: Program<'info, Wormhole>,

    pub token_bridge_program: Program<'info, TokenBridge>,

    #[account(
        seeds = [token_bridge::Config::SEED_PREFIX],
        bump,
        seeds::program = token_bridge_program.key,
    )]
    pub token_bridge_config: Box<Account<'info, token_bridge::Config>>,

    #[account(
        seeds = [token_bridge::SEED_PREFIX_AUTHORITY_SIGNER],
        bump,
        seeds::program = token_bridge_program.key,
    )]
    /// CHECK: Token Bridge authority signer PDA.
    pub token_bridge_authority_signer: UncheckedAccount<'info>,

    #[account(
        seeds = [token_bridge::SEED_PREFIX_CUSTODY_SIGNER],
        bump,
        seeds::program = token_bridge_program.key,
    )]
    /// CHECK: Token Bridge custody signer PDA.
    pub token_bridge_custody_signer: UncheckedAccount<'info>,

    #[account(
        seeds = [token_bridge::SEED_PREFIX_MINT_AUTHORITY],
        bump,
        seeds::program = token_bridge_program.key,
    )]
    /// CHECK: Token Bridge mint authority PDA.
    pub token_bridge_mint_authority: UncheckedAccount<'info>,

    #[account(
        seeds = [wormhole::BridgeData::SEED_PREFIX],
        bump,
        seeds::program = wormhole_program.key,
    )]
    pub wormhole_bridge: Box<Account<'info, wormhole::BridgeData>>,

    #[account(
        seeds = [token_bridge::SEED_PREFIX_EMITTER],
        bump,
        seeds::program = token_bridge_program.key
    )]
    /// CHECK: Token Bridge emitter PDA.
    pub token_bridge_emitter: UncheckedAccount<'info>,

    #[account(
        seeds = [wormhole::FeeCollector::SEED_PREFIX],
        bump,
        seeds::program = wormhole_program.key
    )]
    pub wormhole_fee_collector: Box<Account<'info, wormhole::FeeCollector>>,

    #[account(
        seeds = [
            wormhole::SequenceTracker::SEED_PREFIX,
            token_bridge_emitter.key().as_ref()
        ],
        bump,
        seeds::program = wormhole_program.key
    )]
    pub token_bridge_sequence: Box<Account<'info, wormhole::SequenceTracker>>,

    pub system_program: Program<'info, System>,
}

/// Context for registering a foreign contract.
#[derive(Accounts)]
#[instruction(chain: u16)]
pub struct RegisterForeignContract<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        has_one = owner @ BridgeError::OwnerOnly,
        seeds = [SenderConfig::SEED_PREFIX],
        bump
    )]
    pub config: Box<Account<'info, SenderConfig>>,

    #[account(
        init_if_needed,
        payer = owner,
        seeds = [
            ForeignContract::SEED_PREFIX,
            &chain.to_le_bytes()[..]
        ],
        bump,
        space = ForeignContract::MAXIMUM_SIZE
    )]
    pub foreign_contract: Box<Account<'info, ForeignContract>>,

    #[account(
        seeds = [
            &chain.to_be_bytes(),
            token_bridge_foreign_endpoint.emitter_address.as_ref()
        ],
        bump,
        seeds::program = token_bridge_program.key
    )]
    pub token_bridge_foreign_endpoint: Box<Account<'info, token_bridge::EndpointRegistration>>,

    pub token_bridge_program: Program<'info, TokenBridge>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateRelayerFee<'info> {
    /// CHECK: Owner of the program.
    pub owner: UncheckedAccount<'info>,

    #[account(
        mut,
        has_one = owner @ BridgeError::OwnerOnly,
        seeds = [RedeemerConfig::SEED_PREFIX],
        bump
    )]
    pub config: Box<Account<'info, RedeemerConfig>>,

    pub system_program: Program<'info, System>,
}

/// Context for sending native tokens with payload.
#[derive(Accounts)]
#[instruction(
    batch_id: u32,
    amount: u64,
    recipient_address: [u8; 32],
    recipient_chain: u16,
)]
pub struct SendNativeTokensWithPayload<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        seeds = [SenderConfig::SEED_PREFIX],
        bump
    )]
    pub config: Box<Account<'info, SenderConfig>>,

    #[account(
        seeds = [
            ForeignContract::SEED_PREFIX,
            &recipient_chain.to_le_bytes()[..]
        ],
        bump,
    )]
    pub foreign_contract: Box<Account<'info, ForeignContract>>,

    #[account(mut)]
    pub mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = payer,
    )]
    pub from_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        payer = payer,
        seeds = [
            SEED_PREFIX_TMP,
            mint.key().as_ref(),
        ],
        bump,
        token::mint = mint,
        token::authority = config,
    )]
    pub tmp_token_account: Box<Account<'info, TokenAccount>>,

    pub wormhole_program: Program<'info, Wormhole>,

    pub token_bridge_program: Program<'info, TokenBridge>,

    #[account(
        address = config.token_bridge.config @ BridgeError::InvalidTokenBridgeConfig
    )]
    pub token_bridge_config: Box<Account<'info, token_bridge::Config>>,

    #[account(
        mut,
        seeds = [mint.key().as_ref()],
        bump,
        seeds::program = token_bridge_program.key
    )]
    /// CHECK: Token Bridge custody account.
    pub token_bridge_custody: UncheckedAccount<'info>,

    #[account(
        address = config.token_bridge.authority_signer @ BridgeError::InvalidTokenBridgeAuthoritySigner
    )]
    /// CHECK: Token Bridge authority signer.
    pub token_bridge_authority_signer: UncheckedAccount<'info>,

    #[account(
        address = config.token_bridge.custody_signer @ BridgeError::InvalidTokenBridgeCustodySigner
    )]
    /// CHECK: Token Bridge custody signer.
    pub token_bridge_custody_signer: UncheckedAccount<'info>,

    #[account(
        mut,
        address = config.token_bridge.wormhole_bridge @ BridgeError::InvalidWormholeBridge,
    )]
    pub wormhole_bridge: Box<Account<'info, wormhole::BridgeData>>,

    #[account(
        mut,
        seeds = [
            SEED_PREFIX_BRIDGED,
            &token_bridge_sequence.next_value().to_le_bytes()[..]
        ],
        bump,
    )]
    /// CHECK: Wormhole message account.
    pub wormhole_message: UncheckedAccount<'info>,

    #[account(
        mut,
        address = config.token_bridge.emitter @ BridgeError::InvalidTokenBridgeEmitter
    )]
    /// CHECK: Token Bridge emitter.
    pub token_bridge_emitter: UncheckedAccount<'info>,

    #[account(
        mut,
        address = config.token_bridge.sequence @ BridgeError::InvalidTokenBridgeSequence
    )]
    pub token_bridge_sequence: Box<Account<'info, wormhole::SequenceTracker>>,

    #[account(
        mut,
        address = config.token_bridge.wormhole_fee_collector @ BridgeError::InvalidWormholeFeeCollector
    )]
    pub wormhole_fee_collector: Box<Account<'info, wormhole::FeeCollector>>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub clock: Sysvar<'info, Clock>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(vaa_hash: [u8; 32])]
pub struct RedeemNativeTransferWithPayload<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        constraint = payer.key() == recipient.key() || payer_token_account.key() == anchor_spl::associated_token::get_associated_token_address(&payer.key(), &mint.key()) @ BridgeError::InvalidPayerAta
    )]
    /// CHECK: Payer's token account.
    pub payer_token_account: UncheckedAccount<'info>,

    #[account(
        seeds = [RedeemerConfig::SEED_PREFIX],
        bump
    )]
    pub config: Box<Account<'info, RedeemerConfig>>,

    #[account(
        seeds = [
            ForeignContract::SEED_PREFIX,
            &vaa.emitter_chain().to_le_bytes()[..]
        ],
        bump,
        constraint = foreign_contract.verify(&vaa) @ BridgeError::InvalidForeignContract
    )]
    pub foreign_contract: Box<Account<'info, ForeignContract>>,

    #[account(
        constraint = mint.key() == vaa.data().mint()
    )]
    pub mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = recipient
    )]
    pub recipient_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    /// CHECK: Recipient may differ from payer.
    pub recipient: UncheckedAccount<'info>,

    #[account(
        init,
        payer = payer,
        seeds = [
            SEED_PREFIX_TMP,
            mint.key().as_ref(),
        ],
        bump,
        token::mint = mint,
        token::authority = config
    )]
    pub tmp_token_account: Box<Account<'info, TokenAccount>>,

    pub wormhole_program: Program<'info, Wormhole>,
    pub token_bridge_program: Program<'info, TokenBridge>,

    #[account(
        address = config.token_bridge.config @ BridgeError::InvalidTokenBridgeConfig
    )]
    pub token_bridge_config: Box<Account<'info, token_bridge::Config>>,

    #[account(
        seeds = [
            wormhole::SEED_PREFIX_POSTED_VAA,
            &vaa_hash
        ],
        bump,
        seeds::program = wormhole_program.key,
        constraint = vaa.data().to() == crate::ID || vaa.data().to() == config.key() @ BridgeError::InvalidTransferToAddress,
        constraint = vaa.data().to_chain() == wormhole::CHAIN_ID_SOLANA @ BridgeError::InvalidTransferToChain,
        constraint = vaa.data().token_chain() == wormhole::CHAIN_ID_SOLANA @ BridgeError::InvalidTransferTokenChain
    )]
    pub vaa: Box<Account<'info, PostedTokenMessage>>,

    #[account(mut)]
    /// CHECK: Token Bridge claim account.
    pub token_bridge_claim: UncheckedAccount<'info>,

    #[account(
        address = foreign_contract.token_bridge_foreign_endpoint @ BridgeError::InvalidTokenBridgeForeignEndpoint
    )]
    pub token_bridge_foreign_endpoint: Box<Account<'info, token_bridge::EndpointRegistration>>,

    #[account(
        mut,
        seeds = [mint.key().as_ref()],
        bump,
        seeds::program = token_bridge_program.key
    )]
    pub token_bridge_custody: Account<'info, TokenAccount>,

    #[account(
        address = config.token_bridge.custody_signer @ BridgeError::InvalidTokenBridgeCustodySigner
    )]
    /// CHECK: Token Bridge custody signer.
    pub token_bridge_custody_signer: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

/// Context for sending wrapped tokens with payload.
#[derive(Accounts)]
#[instruction(
    batch_id: u32,
    amount: u64,
    recipient_address: [u8; 32],
    recipient_chain: u16,
)]
pub struct SendWrappedTokensWithPayload<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        seeds = [SenderConfig::SEED_PREFIX],
        bump
    )]
    pub config: Box<Account<'info, SenderConfig>>,

    #[account(
        seeds = [
            ForeignContract::SEED_PREFIX,
            &recipient_chain.to_le_bytes()[..]
        ],
        bump,
    )]
    pub foreign_contract: Box<Account<'info, ForeignContract>>,

    #[account(
        mut,
        seeds = [
            token_bridge::WrappedMint::SEED_PREFIX,
            &token_bridge_wrapped_meta.chain.to_be_bytes(),
            &token_bridge_wrapped_meta.token_address
        ],
        bump,
        seeds::program = token_bridge_program
    )]
    pub token_bridge_wrapped_mint: Box<Account<'info, token_bridge::WrappedMint>>,

    #[account(
        mut,
        associated_token::mint = token_bridge_wrapped_mint,
        associated_token::authority = payer,
    )]
    pub from_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        payer = payer,
        seeds = [
            SEED_PREFIX_TMP,
            token_bridge_wrapped_mint.key().as_ref(),
        ],
        bump,
        token::mint = token_bridge_wrapped_mint,
        token::authority = config,
    )]
    pub tmp_token_account: Box<Account<'info, TokenAccount>>,

    pub wormhole_program: Program<'info, Wormhole>,
    pub token_bridge_program: Program<'info, TokenBridge>,

    #[account(
        seeds = [
            token_bridge::WrappedMeta::SEED_PREFIX,
            token_bridge_wrapped_mint.key().as_ref()
        ],
        bump,
        seeds::program = token_bridge_program.key
    )]
    pub token_bridge_wrapped_meta: Box<Account<'info, token_bridge::WrappedMeta>>,

    #[account(
        mut,
        address = config.token_bridge.config @ BridgeError::InvalidTokenBridgeConfig
    )]
    pub token_bridge_config: Box<Account<'info, token_bridge::Config>>,

    #[account(
        address = config.token_bridge.authority_signer @ BridgeError::InvalidTokenBridgeAuthoritySigner
    )]
    /// CHECK: Token Bridge authority signer.
    pub token_bridge_authority_signer: UncheckedAccount<'info>,

    #[account(
        mut,
        address = config.token_bridge.wormhole_bridge @ BridgeError::InvalidWormholeBridge,
    )]
    pub wormhole_bridge: Box<Account<'info, wormhole::BridgeData>>,

    #[account(
        mut,
        seeds = [
            SEED_PREFIX_BRIDGED,
            &token_bridge_sequence.next_value().to_le_bytes()[..]
        ],
        bump,
    )]
    /// CHECK: Wormhole message account.
    pub wormhole_message: UncheckedAccount<'info>,

    #[account(
        mut,
        address = config.token_bridge.emitter @ BridgeError::InvalidTokenBridgeEmitter
    )]
    /// CHECK: Token Bridge emitter.
    pub token_bridge_emitter: UncheckedAccount<'info>,

    #[account(
        mut,
        address = config.token_bridge.sequence @ BridgeError::InvalidTokenBridgeSequence
    )]
    pub token_bridge_sequence: Box<Account<'info, wormhole::SequenceTracker>>,

    #[account(
        mut,
        address = config.token_bridge.wormhole_fee_collector @ BridgeError::InvalidWormholeFeeCollector
    )]
    pub wormhole_fee_collector: Box<Account<'info, wormhole::FeeCollector>>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub clock: Sysvar<'info, Clock>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(vaa_hash: [u8; 32])]
pub struct RedeemWrappedTransferWithPayload<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        constraint = payer.key() == recipient.key() || payer_token_account.key() == anchor_spl::associated_token::get_associated_token_address(&payer.key(), &token_bridge_wrapped_mint.key()) @ BridgeError::InvalidPayerAta
    )]
    /// CHECK: Payer's token account.
    pub payer_token_account: UncheckedAccount<'info>,

    #[account(
        seeds = [RedeemerConfig::SEED_PREFIX],
        bump
    )]
    pub config: Box<Account<'info, RedeemerConfig>>,

    #[account(
        seeds = [
            ForeignContract::SEED_PREFIX,
            &vaa.emitter_chain().to_le_bytes()[..]
        ],
        bump,
        constraint = foreign_contract.verify(&vaa) @ BridgeError::InvalidForeignContract
    )]
    pub foreign_contract: Box<Account<'info, ForeignContract>>,

    #[account(
        mut,
        seeds = [
            token_bridge::WrappedMint::SEED_PREFIX,
            &vaa.data().token_chain().to_be_bytes(),
            vaa.data().token_address()
        ],
        bump,
        seeds::program = token_bridge_program.key
    )]
    pub token_bridge_wrapped_mint: Box<Account<'info, token_bridge::WrappedMint>>,

    #[account(
        mut,
        associated_token::mint = token_bridge_wrapped_mint,
        associated_token::authority = recipient
    )]
    pub recipient_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    /// CHECK: Recipient may differ from payer.
    pub recipient: UncheckedAccount<'info>,

    #[account(
        init,
        payer = payer,
        seeds = [
            SEED_PREFIX_TMP,
            token_bridge_wrapped_mint.key().as_ref(),
        ],
        bump,
        token::mint = token_bridge_wrapped_mint,
        token::authority = config
    )]
    pub tmp_token_account: Box<Account<'info, TokenAccount>>,

    pub wormhole_program: Program<'info, Wormhole>,
    pub token_bridge_program: Program<'info, TokenBridge>,

    #[account(
        seeds = [
            token_bridge::WrappedMeta::SEED_PREFIX,
            token_bridge_wrapped_mint.key().as_ref()
        ],
        bump,
        seeds::program = token_bridge_program.key
    )]
    pub token_bridge_wrapped_meta: Box<Account<'info, token_bridge::WrappedMeta>>,

    #[account(
        address = config.token_bridge.config @ BridgeError::InvalidTokenBridgeConfig
    )]
    pub token_bridge_config: Box<Account<'info, token_bridge::Config>>,

    #[account(
        seeds = [
            wormhole::SEED_PREFIX_POSTED_VAA,
            &vaa_hash
        ],
        bump,
        seeds::program = wormhole_program.key,
        constraint = vaa.data().to() == crate::ID || vaa.data().to() == config.key() @ BridgeError::InvalidTransferToAddress,
        constraint = vaa.data().to_chain() == wormhole::CHAIN_ID_SOLANA @ BridgeError::InvalidTransferToChain,
        constraint = vaa.data().token_chain() != wormhole::CHAIN_ID_SOLANA @ BridgeError::InvalidTransferTokenChain
    )]
    pub vaa: Box<Account<'info, PostedTokenMessage>>,

    #[account(mut)]
    /// CHECK: Token Bridge claim account.
    pub token_bridge_claim: UncheckedAccount<'info>,

    #[account(
        address = foreign_contract.token_bridge_foreign_endpoint @ BridgeError::InvalidTokenBridgeForeignEndpoint
    )]
    pub token_bridge_foreign_endpoint: Box<Account<'info, token_bridge::EndpointRegistration>>,

    #[account(
        address = config.token_bridge.mint_authority @ BridgeError::InvalidTokenBridgeMintAuthority
    )]
    /// CHECK: Token Bridge mint authority.
    pub token_bridge_mint_authority: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}
