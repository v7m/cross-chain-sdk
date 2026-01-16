use anchor_lang::{AnchorDeserialize, AnchorSerialize};
use std::io;
use wormhole_anchor_sdk::token_bridge;
use wormhole_io::Readable;

const PAYLOAD_ID_HELLO: u8 = 1;

#[derive(Clone, Copy)]
pub enum TokenMessage {
    Hello { recipient: [u8; 32] },
}

impl AnchorSerialize for TokenMessage {
    fn serialize<W: io::Write>(&self, writer: &mut W) -> io::Result<()> {
        match self {
            TokenMessage::Hello { recipient } => {
                PAYLOAD_ID_HELLO.serialize(writer)?;
                recipient.serialize(writer)
            }
        }
    }
}

impl AnchorDeserialize for TokenMessage {
    fn deserialize_reader<R: io::Read>(reader: &mut R) -> io::Result<Self> {
        match u8::read(reader)? {
            PAYLOAD_ID_HELLO => Ok(TokenMessage::Hello {
                recipient: Readable::read(reader)?,
            }),
            _ => Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "invalid payload ID",
            )),
        }
    }
}

pub type PostedTokenMessage = token_bridge::PostedTransferWith<TokenMessage>;
