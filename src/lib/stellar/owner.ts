"use client";

import {
  Asset,
  Horizon,
  Operation,
  TransactionBuilder,
  BASE_FEE,
  Memo,
} from "@stellar/stellar-sdk";
import { STELLAR_HORIZON_URL, STELLAR_NETWORK_PASSPHRASE } from "./network";
import { signXdr } from "./wallet";

const BLEND_STUB =
  process.env.NEXT_PUBLIC_BLEND_STUB_PUBLIC ??
  "GDHII67HBWUSO22DUUH5KAKO7AXQDWB4HGWYNOWJG7DXV5IUTQ45YNX4";

const horizon = new Horizon.Server(STELLAR_HORIZON_URL);

/**
 * Owner action txs — paid from the owner's wallet (requires Freighter signature).
 *
 * - withdraw: owner → arbitrary destination (defaults to self; user may supply).
 * - defi_deposit: owner → BLEND_STUB account on testnet (placeholder for Blend SDK).
 * - mixed: a single composite tx with two payment operations.
 */
export async function ownerTx(params: {
  ownerPublicKey: string;
  withdrawTo?: string; // if kind=withdraw or mixed, defaults to owner (self)
  withdrawUsdc: number;
  defiUsdc: number;
  propertySlug: string;
}): Promise<{ hash: string }> {
  const { ownerPublicKey, withdrawTo, withdrawUsdc, defiUsdc, propertySlug } = params;

  if (withdrawUsdc <= 0 && defiUsdc <= 0) {
    throw new Error("Nothing to move.");
  }

  const account = await horizon.loadAccount(ownerPublicKey);

  const ops = [] as number[];
  const opsCount = (withdrawUsdc > 0 ? 1 : 0) + (defiUsdc > 0 ? 1 : 0);
  void ops;
  const builder = new TransactionBuilder(account, {
    fee: (Number(BASE_FEE) * opsCount).toString(),
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  });

  if (withdrawUsdc > 0) {
    builder.addOperation(
      Operation.payment({
        destination: withdrawTo ?? ownerPublicKey,
        asset: Asset.native(),
        amount: withdrawUsdc.toFixed(7),
      }),
    );
  }

  if (defiUsdc > 0) {
    builder.addOperation(
      Operation.payment({
        destination: BLEND_STUB,
        asset: Asset.native(),
        amount: defiUsdc.toFixed(7),
      }),
    );
  }

  builder.addMemo(Memo.text(`own:${propertySlug.slice(0, 20)}`));
  builder.setTimeout(180);
  const tx = builder.build();

  const signed = await signXdr(tx.toXDR(), ownerPublicKey);
  const signedTx = TransactionBuilder.fromXDR(signed, STELLAR_NETWORK_PASSPHRASE);
  const res = await horizon.submitTransaction(signedTx);
  return { hash: res.hash };
}
