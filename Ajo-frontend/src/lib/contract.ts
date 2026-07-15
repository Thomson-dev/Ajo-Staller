import { Client, networks } from 'ajo-client'
import { kit } from './wallet'

// Native XLM's Stellar Asset Contract on testnet — used as the round-contribution token.
export const NATIVE_TOKEN_TESTNET =
  'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'

export function getAjoClient(publicKey?: string) {
  return new Client({
    ...networks.testnet,
    rpcUrl: 'https://soroban-testnet.stellar.org',
    publicKey,
    signTransaction: (xdr, opts) => kit.signTransaction(xdr, opts),
  })
}
