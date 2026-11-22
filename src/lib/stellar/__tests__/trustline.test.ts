// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { Asset, Keypair, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import {
  assetBalance,
  ensureTrustlineOp,
  hasTrustline,
  type TrustlineBalance,
} from "../trustline";

const ISSUER = Keypair.random().publicKey();
const OTHER_ISSUER = Keypair.random().publicKey();
const usdc = new Asset("USDC", ISSUER);

function balances(
  overrides: Partial<TrustlineBalance>[] = [],
): { balances: TrustlineBalance[] } {
  const defaults: TrustlineBalance[] = [
    { asset_type: "native", balance: "100.0" },
  ];
  return { balances: [...defaults, ...(overrides as TrustlineBalance[])] };
}

describe("hasTrustline", () => {
  it("returns true for native XLM (every account trusts native)", () => {
    expect(hasTrustline(balances(), Asset.native())).toBe(true);
  });

  it("returns true when the matching (code, issuer) line exists", () => {
    const acct = balances([
      {
        asset_type: "credit_alphanum4",
        asset_code: "USDC",
        asset_issuer: ISSUER,
        balance: "0.0",
      },
    ]);
    expect(hasTrustline(acct, usdc)).toBe(true);
  });

  it("returns false when code matches but issuer does not", () => {
    const acct = balances([
      {
        asset_type: "credit_alphanum4",
        asset_code: "USDC",
        asset_issuer: OTHER_ISSUER,
        balance: "100.0",
      },
    ]);
    expect(hasTrustline(acct, usdc)).toBe(false);
  });

  it("returns false when there is no USDC line at all", () => {
    expect(hasTrustline(balances(), usdc)).toBe(false);
  });
});

describe("assetBalance", () => {
  it("returns the native XLM balance when asked for native", () => {
    expect(assetBalance(balances(), Asset.native())).toBe(100);
  });

  it("returns 0 when the trustline is missing", () => {
    expect(assetBalance(balances(), usdc)).toBe(0);
  });

  it("returns the balance when the trustline is present", () => {
    const acct = balances([
      {
        asset_type: "credit_alphanum4",
        asset_code: "USDC",
        asset_issuer: ISSUER,
        balance: "250.5",
      },
    ]);
    expect(assetBalance(acct, usdc)).toBe(250.5);
  });
});

describe("ensureTrustlineOp", () => {
  it("is a no-op for native assets", () => {
    const builder = {
      addOperation: vi.fn(),
    } as unknown as TransactionBuilder;
    expect(ensureTrustlineOp(builder, balances(), Asset.native())).toBe(false);
    expect((builder.addOperation as unknown as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it("is a no-op when the trustline is already in place", () => {
    const builder = {
      addOperation: vi.fn(),
    } as unknown as TransactionBuilder;
    const acct = balances([
      {
        asset_type: "credit_alphanum4",
        asset_code: "USDC",
        asset_issuer: ISSUER,
        balance: "0.0",
      },
    ]);
    expect(ensureTrustlineOp(builder, acct, usdc)).toBe(false);
  });

  it("adds a ChangeTrust op when the trustline is missing", () => {
    const calls: unknown[] = [];
    const builder = {
      addOperation: (op: unknown) => {
        calls.push(op);
        return builder;
      },
    } as unknown as TransactionBuilder;
    const added = ensureTrustlineOp(builder, balances(), usdc);
    expect(added).toBe(true);
    expect(calls).toHaveLength(1);
    // The SDK's Operation.changeTrust returns an xdr.Operation; we just assert
    // that it was produced from the same helper by running it ourselves and
    // comparing its body type.
    const ref = Operation.changeTrust({ asset: usdc });
    expect(JSON.stringify(calls[0])).toBe(JSON.stringify(ref));
  });
});
