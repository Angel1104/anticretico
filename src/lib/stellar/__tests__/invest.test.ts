// @vitest-environment node
/**
 * Tests the USDC trustline dance in investInProperty.
 *
 * Horizon and Freighter are both mocked so the tests never touch a network.
 * We assert on:
 *   - first-time investor: tx contains a ChangeTrust op followed by a payment
 *   - repeat investor with balance: single payment op, no ChangeTrust
 *   - repeat investor without balance: InvestNoUsdcBalanceError
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";

const ISSUER_KP = Keypair.random();
const ISSUER = ISSUER_KP.publicKey();
const INVESTOR_KP = Keypair.random();
const INVESTOR = INVESTOR_KP.publicKey();

process.env.NEXT_PUBLIC_USDC_CODE = "USDC";
process.env.NEXT_PUBLIC_USDC_ISSUER = ISSUER;

type BalanceRow = {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
};

const loadAccountMock = vi.fn();
const submitTransactionMock = vi.fn();

vi.mock("@stellar/stellar-sdk", async () => {
  const actual = await vi.importActual<typeof import("@stellar/stellar-sdk")>(
    "@stellar/stellar-sdk",
  );
  return {
    ...actual,
    Horizon: {
      ...actual.Horizon,
      Server: class {
        loadAccount = loadAccountMock;
        submitTransaction = submitTransactionMock;
      },
    },
  };
});

vi.mock("../wallet", () => ({
  signXdr: vi.fn(async (xdr: string) => xdr),
}));

describe("investInProperty + trustline", () => {
  beforeEach(() => {
    loadAccountMock.mockReset();
    submitTransactionMock.mockReset();
    submitTransactionMock.mockResolvedValue({ hash: "test-tx-hash" });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function stellarAccount(balances: BalanceRow[]) {
    const { Account } = await import("@stellar/stellar-sdk");
    const acct = new Account(INVESTOR, "0");
    (acct as unknown as { balances: BalanceRow[] }).balances = balances;
    return acct;
  }

  it("prepends ChangeTrust and a payment for a first-time USDC investor", async () => {
    const acct = await stellarAccount([
      { asset_type: "native", balance: "10000.0" },
    ]);
    loadAccountMock.mockResolvedValue(acct);

    const { investInProperty } = await import("../invest");
    const res = await investInProperty({
      investorPublicKey: acct.accountId(),
      amountUsdc: 100,
      propertySlug: "demo",
    });

    expect(res.hash).toBe("test-tx-hash");
    expect(res.trustlineAdded).toBe(true);

    expect(submitTransactionMock).toHaveBeenCalledTimes(1);
    const submitted = submitTransactionMock.mock.calls[0][0];
    const ops = submitted.operations;
    expect(ops).toHaveLength(2);
    expect(ops[0].type).toBe("changeTrust");
    expect(ops[1].type).toBe("payment");
    expect(ops[1].asset.code).toBe("USDC");
    expect(ops[1].asset.issuer).toBe(ISSUER);
  });

  it("sends a plain payment when the trustline is already open", async () => {
    const acct = await stellarAccount([
      { asset_type: "native", balance: "10000.0" },
      {
        asset_type: "credit_alphanum4",
        asset_code: "USDC",
        asset_issuer: ISSUER,
        balance: "500.0",
      },
    ]);
    loadAccountMock.mockResolvedValue(acct);

    const { investInProperty } = await import("../invest");
    const res = await investInProperty({
      investorPublicKey: acct.accountId(),
      amountUsdc: 100,
      propertySlug: "demo",
    });

    expect(res.trustlineAdded).toBe(false);

    const submitted = submitTransactionMock.mock.calls[0][0];
    expect(submitted.operations).toHaveLength(1);
    expect(submitted.operations[0].type).toBe("payment");
  });

  it("throws InvestNoUsdcBalanceError when the trustline is open but balance is below the ask", async () => {
    const acct = await stellarAccount([
      { asset_type: "native", balance: "10000.0" },
      {
        asset_type: "credit_alphanum4",
        asset_code: "USDC",
        asset_issuer: ISSUER,
        balance: "50.0",
      },
    ]);
    loadAccountMock.mockResolvedValue(acct);

    const { investInProperty, InvestNoUsdcBalanceError } = await import(
      "../invest"
    );
    await expect(
      investInProperty({
        investorPublicKey: acct.accountId(),
        amountUsdc: 100,
        propertySlug: "demo",
      }),
    ).rejects.toBeInstanceOf(InvestNoUsdcBalanceError);
    expect(submitTransactionMock).not.toHaveBeenCalled();
  });
});
