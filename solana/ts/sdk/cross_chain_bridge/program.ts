import { Connection, PublicKeyInitData, PublicKey } from "@solana/web3.js";
import { Program, Provider } from "@coral-xyz/anchor";

import { CrossChainBridge } from "../../../target/types/cross_chain_bridge";
import IDL from "../../../target/idl/cross_chain_bridge.json";

export function createCrossChainBridgeProgramInterface(
  connection: Connection,
  programId: PublicKeyInitData,
  payer?: PublicKeyInitData
): Program<CrossChainBridge> {
  const provider: Provider = {
    connection,
    publicKey: payer === undefined ? undefined : new PublicKey(payer),
  };
  const idlWithAddress = {
    ...IDL,
    metadata: {
      ...IDL.metadata,
      address: new PublicKey(programId).toString(),
    },
  } as any;
  return new Program<CrossChainBridge>(idlWithAddress, provider);
}
