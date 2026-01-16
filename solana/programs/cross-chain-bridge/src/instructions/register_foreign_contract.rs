use anchor_lang::prelude::*;
use wormhole_anchor_sdk::wormhole;

use crate::{context::RegisterForeignContract, error::BridgeError};

pub fn handler(
    ctx: Context<RegisterForeignContract>,
    chain: u16,
    address: [u8; 32],
) -> Result<()> {
    require!(
        chain > 0 && chain != wormhole::CHAIN_ID_SOLANA && !address.iter().all(|&x| x == 0),
        BridgeError::InvalidForeignContract,
    );

    let foreign_contract = &mut ctx.accounts.foreign_contract;
    foreign_contract.chain = chain;
    foreign_contract.address = address;
    foreign_contract.token_bridge_foreign_endpoint =
        ctx.accounts.token_bridge_foreign_endpoint.key();

    msg!(
        "Foreign contract registered: chain={}, address={:?}",
        chain,
        address
    );

    Ok(())
}
