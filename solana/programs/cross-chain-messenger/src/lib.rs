use anchor_lang::prelude::*;

pub mod context;
pub mod error;
pub mod instructions;
pub mod message;
pub mod state;

pub use context::*;
pub use state::*;

declare_id!("6KCA7CLpqcAqgTNcwYCVKYRixvvRqcMMrAN7FAH1qJxW");

#[program]
pub mod cross_chain_messenger {
    use super::*;

    /// Initialize the messenger program.
    /// Creates the config account and sets the owner.
    /// Also posts an initial "Alive" message to create the sequence tracker.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::initialize::handler(ctx)
    }

    /// Register a foreign emitter (messenger contract on another chain).
    /// Only the program owner can call this instruction.
    pub fn register_emitter(
        ctx: Context<RegisterEmitter>,
        chain: u16,
        address: [u8; 32],
    ) -> Result<()> {
        instructions::register_emitter::handler(ctx, chain, address)
    }

    /// Send a message to another chain via Wormhole.
    /// The message is encoded with a payload ID and sent through Wormhole Core.
    /// Guardians will attest the message, which can then be received on the target chain.
    pub fn send_message(ctx: Context<SendMessage>, payload: Vec<u8>) -> Result<()> {
        instructions::send_message::handler(ctx, payload)
    }

    /// Receive and verify a message from another chain.
    /// The VAA must be verified by Wormhole before calling this instruction.
    /// The message is stored in a Received account for later processing.
    pub fn receive_message(ctx: Context<ReceiveMessage>, vaa_hash: [u8; 32]) -> Result<()> {
        instructions::receive_message::handler(ctx, vaa_hash)
    }

    /// Close a Received account and return rent to the payer.
    /// Only the program owner can call this instruction.
    pub fn close_received(
        ctx: Context<CloseReceived>,
        emitter_chain: u16,
        sequence: u64,
    ) -> Result<()> {
        instructions::close_received::handler(ctx, emitter_chain, sequence)
    }
}
