import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CCAWRA5NZZFRM62JAQHK75UQTVLYGSB4GX4HX6AP7WX66FOGHQ66MVJJ",
  }
} as const


export interface Circle {
  admin: string;
  amount: i128;
  collateral: i128;
  completed: boolean;
  round: u32;
  round_duration: u64;
  round_start: u64;
  token: string;
}

export type DataKey = {tag: "NextCircleId", values: void} | {tag: "Circle", values: readonly [u64]} | {tag: "Members", values: readonly [u64]} | {tag: "Paid", values: readonly [u64]} | {tag: "Defaulted", values: readonly [u64]} | {tag: "Received", values: readonly [u64]} | {tag: "Reputation", values: readonly [string]};

export interface Client {
  /**
   * Construct and simulate a join transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  join: ({circle_id, member}: {circle_id: u64, member: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a deposit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  deposit: ({circle_id, member}: {circle_id: u64, member: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_paid transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_paid: ({circle_id}: {circle_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Array<string>>>

  /**
   * Construct and simulate a get_circle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_circle: ({circle_id}: {circle_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Circle>>

  /**
   * Construct and simulate a close_round transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  close_round: ({circle_id}: {circle_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_members transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_members: ({circle_id}: {circle_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Array<string>>>

  /**
   * Construct and simulate a get_received transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_received: ({circle_id}: {circle_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Array<string>>>

  /**
   * Construct and simulate a create_circle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  create_circle: ({admin, token, amount, collateral, round_duration}: {admin: string, token: string, amount: i128, collateral: i128, round_duration: u64}, options?: MethodOptions) => Promise<AssembledTransaction<u64>>

  /**
   * Construct and simulate a get_defaulted transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_defaulted: ({circle_id}: {circle_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Array<string>>>

  /**
   * Construct and simulate a get_reputation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_reputation: ({member}: {member: string}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAQAAAAAAAAAAAAAABkNpcmNsZQAAAAAACAAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAACmNvbGxhdGVyYWwAAAAAAAsAAAAAAAAACWNvbXBsZXRlZAAAAAAAAAEAAAAAAAAABXJvdW5kAAAAAAAABAAAAAAAAAAOcm91bmRfZHVyYXRpb24AAAAAAAYAAAAAAAAAC3JvdW5kX3N0YXJ0AAAAAAYAAAAAAAAABXRva2VuAAAAAAAAEw==",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABwAAAAAAAAAAAAAADE5leHRDaXJjbGVJZAAAAAEAAAAAAAAABkNpcmNsZQAAAAAAAQAAAAYAAAABAAAAAAAAAAdNZW1iZXJzAAAAAAEAAAAGAAAAAQAAAAAAAAAEUGFpZAAAAAEAAAAGAAAAAQAAAAAAAAAJRGVmYXVsdGVkAAAAAAAAAQAAAAYAAAABAAAAAAAAAAhSZWNlaXZlZAAAAAEAAAAGAAAAAQAAAAAAAAAKUmVwdXRhdGlvbgAAAAAAAQAAABM=",
        "AAAAAAAAAAAAAAAEam9pbgAAAAIAAAAAAAAACWNpcmNsZV9pZAAAAAAAAAYAAAAAAAAABm1lbWJlcgAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAHZGVwb3NpdAAAAAACAAAAAAAAAAljaXJjbGVfaWQAAAAAAAAGAAAAAAAAAAZtZW1iZXIAAAAAABMAAAAA",
        "AAAAAAAAAAAAAAAIZ2V0X3BhaWQAAAABAAAAAAAAAAljaXJjbGVfaWQAAAAAAAAGAAAAAQAAA+oAAAAT",
        "AAAAAAAAAAAAAAAKZ2V0X2NpcmNsZQAAAAAAAQAAAAAAAAAJY2lyY2xlX2lkAAAAAAAABgAAAAEAAAfQAAAABkNpcmNsZQAA",
        "AAAAAAAAAAAAAAALY2xvc2Vfcm91bmQAAAAAAQAAAAAAAAAJY2lyY2xlX2lkAAAAAAAABgAAAAA=",
        "AAAAAAAAAAAAAAALZ2V0X21lbWJlcnMAAAAAAQAAAAAAAAAJY2lyY2xlX2lkAAAAAAAABgAAAAEAAAPqAAAAEw==",
        "AAAAAAAAAAAAAAAMZ2V0X3JlY2VpdmVkAAAAAQAAAAAAAAAJY2lyY2xlX2lkAAAAAAAABgAAAAEAAAPqAAAAEw==",
        "AAAAAAAAAAAAAAANY3JlYXRlX2NpcmNsZQAAAAAAAAUAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAACmNvbGxhdGVyYWwAAAAAAAsAAAAAAAAADnJvdW5kX2R1cmF0aW9uAAAAAAAGAAAAAQAAAAY=",
        "AAAAAAAAAAAAAAANZ2V0X2RlZmF1bHRlZAAAAAAAAAEAAAAAAAAACWNpcmNsZV9pZAAAAAAAAAYAAAABAAAD6gAAABM=",
        "AAAAAAAAAAAAAAAOZ2V0X3JlcHV0YXRpb24AAAAAAAEAAAAAAAAABm1lbWJlcgAAAAAAEwAAAAEAAAAE" ]),
      options
    )
  }
  public readonly fromJSON = {
    join: this.txFromJSON<null>,
        deposit: this.txFromJSON<null>,
        get_paid: this.txFromJSON<Array<string>>,
        get_circle: this.txFromJSON<Circle>,
        close_round: this.txFromJSON<null>,
        get_members: this.txFromJSON<Array<string>>,
        get_received: this.txFromJSON<Array<string>>,
        create_circle: this.txFromJSON<u64>,
        get_defaulted: this.txFromJSON<Array<string>>,
        get_reputation: this.txFromJSON<u32>
  }
}