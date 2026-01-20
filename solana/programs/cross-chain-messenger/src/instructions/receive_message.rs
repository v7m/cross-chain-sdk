use anchor_lang::prelude::*;

use crate::{
    context::ReceiveMessage,
    error::MessengerError,
    message::MessengerMessage,
    state::MESSAGE_MAX_LENGTH,
};

pub fn handler(ctx: Context<ReceiveMessage>, vaa_hash: [u8; 32]) -> Result<()> {
    let posted_message = &ctx.accounts.posted;

    if let MessengerMessage::Message { payload } = posted_message.data() {
        require!(
            payload.len() <= MESSAGE_MAX_LENGTH,
            MessengerError::InvalidMessage,
        );

        let received = &mut ctx.accounts.received;
        received.batch_id = posted_message.batch_id();
        received.wormhole_message_hash = vaa_hash;
        received.payload = payload.clone();

        msg!("=== MESSAGE RECEIVED ===");
        msg!("Emitter chain: {}", posted_message.emitter_chain());
        msg!("Sequence: {}", posted_message.sequence());
        msg!("Payload length: {} bytes", payload.len());
        
        if let Ok(text) = std::str::from_utf8(&payload) {
            msg!("Payload (text): {}", text);
        } else {
            msg!("Payload (hex): {:?}", &payload[..std::cmp::min(64, payload.len())]);
        }
        msg!("========================");

        Ok(())
    } else {
        Err(MessengerError::InvalidMessage.into())
    }
}
