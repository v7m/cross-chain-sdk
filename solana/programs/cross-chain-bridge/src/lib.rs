use anchor_lang::prelude::*;

pub mod context;
pub mod error;
pub mod instructions;
pub mod message;
pub mod state;

pub use context::*;
pub use state::*;

declare_id!("5HVG1XFoN3KXa6gcFkCs7iFcHvtsbmY6drvP34S1mwn4");

#[program]
pub mod cross_chain_bridge {
    use super::*;

    /// Initializes the program with sender and redeemer configurations.
    pub fn initialize(
        ctx: Context<Initialize>,
        relayer_fee: u32,
        relayer_fee_precision: u32,
    ) -> Result<()> {
        instructions::initialize::handler(ctx, relayer_fee, relayer_fee_precision)
    }

    /// Registers a foreign contract for a given chain.
    pub fn register_foreign_contract(
        ctx: Context<RegisterForeignContract>,
        chain: u16,
        address: [u8; 32],
    ) -> Result<()> {
        instructions::register_foreign_contract::handler(ctx, chain, address)
    }

    /// Updates the relayer fee configuration.
    pub fn update_relayer_fee(
        ctx: Context<UpdateRelayerFee>,
        relayer_fee: u32,
        relayer_fee_precision: u32,
    ) -> Result<()> {
        instructions::update_relayer_fee::handler(ctx, relayer_fee, relayer_fee_precision)
    }

    /// Sends native tokens with a payload to a foreign chain.
    pub fn send_native_tokens_with_payload(
        ctx: Context<SendNativeTokensWithPayload>,
        batch_id: u32,
        amount: u64,
        recipient_address: [u8; 32],
        recipient_chain: u16,
    ) -> Result<()> {
        instructions::send_native_tokens::handler(
            ctx,
            batch_id,
            amount,
            recipient_address,
            recipient_chain,
        )
    }

    /// Redeems a native token transfer from a foreign chain.
    pub fn redeem_native_transfer_with_payload(
        ctx: Context<RedeemNativeTransferWithPayload>,
        vaa_hash: [u8; 32],
    ) -> Result<()> {
        instructions::redeem_native_transfer::handler(ctx, vaa_hash)
    }

    /// Sends wrapped tokens with a payload to a foreign chain.
    pub fn send_wrapped_tokens_with_payload(
        ctx: Context<SendWrappedTokensWithPayload>,
        batch_id: u32,
        amount: u64,
        recipient_address: [u8; 32],
        recipient_chain: u16,
    ) -> Result<()> {
        instructions::send_wrapped_tokens::handler(
            ctx,
            batch_id,
            amount,
            recipient_address,
            recipient_chain,
        )
    }

    /// Redeems a wrapped token transfer from a foreign chain.
    pub fn redeem_wrapped_transfer_with_payload(
        ctx: Context<RedeemWrappedTransferWithPayload>,
        vaa_hash: [u8; 32],
    ) -> Result<()> {
        instructions::redeem_wrapped_transfer::handler(ctx, vaa_hash)
    }
}
