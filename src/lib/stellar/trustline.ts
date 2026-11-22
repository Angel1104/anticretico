import {
  Asset,
  Horizon,
  Operation,
  type TransactionBuilder,
} from "@stellar/stellar-sdk";
import { USDC_ASSET, IS_USDC_CONFIGURED } from "./network";

/**
 * Horizon account balance entry shape that we care about. We purposefully keep
 * this loose so Horizon mocks in tests only need the minimum.
 */
export type TrustlineBalance = {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
};

type AccountLike = {
  balances: TrustlineBalance[];
};

/**
 * Does `account` already hold a trustline to the given asset?
 *
 * For native XLM this is always true (every funded account "trusts" native).
 */
export function hasTrustline(
  account: AccountLike,
  asset: Asset = USDC_ASSET,
): boolean {
  if (asset.isNative()) return true;
  return account.balances.some(
    (b) =>
      b.asset_type !== "native" &&
      b.asset_code === asset.getCode() &&
      b.asset_issuer === asset.getIssuer(),
  );
}

/**
 * Current balance of `asset` on `account`, as a number. Returns 0 if no trustline.
 */
export function assetBalance(
  account: AccountLike,
  asset: Asset = USDC_ASSET,
): number {
  if (asset.isNative()) {
    const native = account.balances.find((b) => b.asset_type === "native");
    return native ? Number(native.balance) : 0;
  }
  const line = account.balances.find(
    (b) =>
      b.asset_type !== "native" &&
      b.asset_code === asset.getCode() &&
      b.asset_issuer === asset.getIssuer(),
  );
  return line ? Number(line.balance) : 0;
}

/**
 * Prepend a `ChangeTrust` operation for `asset` to the builder if the account
 * does not already have a trustline. Native assets are a no-op.
 *
 * Returns `true` when the operation was added (so callers can surface a
 * one-time "we added a trustline" hint in the UI).
 */
export function ensureTrustlineOp(
  builder: TransactionBuilder,
  account: AccountLike,
  asset: Asset = USDC_ASSET,
): boolean {
  if (asset.isNative()) return false;
  if (hasTrustline(account, asset)) return false;
  builder.addOperation(
    Operation.changeTrust({
      asset,
    }),
  );
  return true;
}

/**
 * Fetch `publicKey`'s account from Horizon and return its full balance list.
 */
export async function loadAccountBalances(
  horizon: Horizon.Server,
  publicKey: string,
): Promise<TrustlineBalance[]> {
  const account = await horizon.loadAccount(publicKey);
  return account.balances as unknown as TrustlineBalance[];
}

export { IS_USDC_CONFIGURED };
