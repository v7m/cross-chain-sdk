use anchor_lang::{prelude::Pubkey, AnchorDeserialize, AnchorSerialize};
use std::io;
use wormhole_io::Readable;

const PAYLOAD_ID_ALIVE: u8 = 0;
const PAYLOAD_ID_MESSAGE: u8 = 1;

pub const MESSAGE_MAX_LENGTH: usize = 1024;

#[derive(Clone)]
/// Message types for the messenger program.
/// 
/// * `Alive`: Payload ID == 0. Emitted during initialization.
/// * `Message`: Payload ID == 1. Arbitrary payload data.
pub enum MessengerMessage {
    Alive { program_id: Pubkey },
    Message { payload: Vec<u8> },
}

impl AnchorSerialize for MessengerMessage {
    fn serialize<W: io::Write>(&self, writer: &mut W) -> io::Result<()> {
        match self {
            MessengerMessage::Alive { program_id } => {
                PAYLOAD_ID_ALIVE.serialize(writer)?;
                program_id.serialize(writer)
            }
            MessengerMessage::Message { payload } => {
                if payload.len() > MESSAGE_MAX_LENGTH {
                    Err(io::Error::new(
                        io::ErrorKind::InvalidInput,
                        format!("payload exceeds {MESSAGE_MAX_LENGTH} bytes"),
                    ))
                } else {
                    PAYLOAD_ID_MESSAGE.serialize(writer)?;
                    (payload.len() as u16).to_be_bytes().serialize(writer)?;
                    for item in payload {
                        item.serialize(writer)?;
                    }
                    Ok(())
                }
            }
        }
    }
}

impl AnchorDeserialize for MessengerMessage {
    fn deserialize_reader<R: io::Read>(reader: &mut R) -> io::Result<Self> {
        match u8::read(reader)? {
            PAYLOAD_ID_ALIVE => Ok(MessengerMessage::Alive {
                program_id: Pubkey::try_from(<[u8; 32]>::read(reader)?).unwrap(),
            }),
            PAYLOAD_ID_MESSAGE => {
                let length = u16::read(reader)? as usize;
                if length > MESSAGE_MAX_LENGTH {
                    Err(io::Error::new(
                        io::ErrorKind::InvalidInput,
                        format!("payload exceeds {MESSAGE_MAX_LENGTH} bytes"),
                    ))
                } else {
                    let mut buf = vec![0; length];
                    reader.read_exact(&mut buf)?;
                    Ok(MessengerMessage::Message { payload: buf })
                }
            }
            _ => Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "invalid payload ID",
            )),
        }
    }
}
