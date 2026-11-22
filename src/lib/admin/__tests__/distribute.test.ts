// @vitest-environment node
/**
 * Tests that distributeMonthlyRent SKIPS holders without a USDC trustline and
 * reports them via `skippedHolders`, rather than failing the whole run.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";

const ISSUER = Keypair.random().publicKey();
const ADMIN = Keypair.random().publicKey();
const DISTRIBUTOR_KP = Keypair.random();
const TRUSTS_KP = Keypair.random();
const SKIPS_KP = Keypair.random();

process.env.NEXT_PUBLIC_USDC_CODE = "USDC";
process.env.NEXT_PUBLIC_USDC_ISSUER = ISSUER;
process.env.NEXT_PUBLIC_ADMIN_WALLETS = ADMIN;
process.env.DISTRIBUTOR_SECRET = DISTRIBUTOR_KP.secret();

const remoteHasTrustlineMock = vi.fn();
const serverBatchPaymentMock = vi.fn();

vi.mock("@/lib/stellar/server", () => ({
  remoteHasTrustline: remoteHasTrustlineMock,
  serverBatchPayment: serverBatchPaymentMock,
}));

function fakeDb(
  property: Record<string, unknown>,
  positions: Array<{ investor_wallet: string; usdc_invested: number }>,
) {
  const propTable = {
    select: vi.fn(() => propTable),
    eq: vi.fn(() => propTable),
    maybeSingle: vi.fn().mockResolvedValue({ data: property, error: null }),
  };

  const posTable = {
    select: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ data: positions, error: null }),
    })),
  };

  const distributionsTable = {
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  const propertiesUpdateTable = {
    update: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "properties") {
        return {
          select: propTable.select,
          update: propertiesUpdateTable.update,
        };
      }
      if (table === "positions") return posTable;
      if (table === "distributions") return distributionsTable;
      throw new Error(`unexpected table ${table}`);
    }),
  };
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: vi.fn() })),
}));

describe("distributeMonthlyRent — trustline skip", () => {
  beforeEach(() => {
    remoteHasTrustlineMock.mockReset();
    serverBatchPaymentMock.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.invalid";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
  });

  it("skips a holder without USDC trustline and lists them in the result", async () => {
    const trusts = TRUSTS_KP.publicKey();
    const skips = SKIPS_KP.publicKey();

    const db = fakeDb(
      {
        state: "Alquilado",
        slug: "casa-1",
        rent_monthly_usdc: 1000,
      },
      [
        { investor_wallet: trusts, usdc_invested: 500 },
        { investor_wallet: skips, usdc_invested: 500 },
      ],
    );
    const { createClient } = await import("@supabase/supabase-js");
    (createClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(db);

    remoteHasTrustlineMock.mockImplementation(async (w: string) => w === trusts);
    serverBatchPaymentMock.mockResolvedValue({ hash: "dist-hash" });

    const { distributeMonthlyRent } = await import("../distribute");
    const res = await distributeMonthlyRent({
      propertyId: "prop-1",
      adminWallet: ADMIN,
    });

    expect(res.hash).toBe("dist-hash");
    expect(res.skippedHolders).toEqual([skips]);
    expect(res.holdersCount).toBe(1);

    expect(serverBatchPaymentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        payments: expect.arrayContaining([
          expect.objectContaining({ toPublic: trusts }),
        ]),
      }),
    );
    // The skipped wallet should NOT appear in the on-chain tx.
    const payments = serverBatchPaymentMock.mock.calls[0][0].payments;
    expect(payments.some((p: { toPublic: string }) => p.toPublic === skips)).toBe(
      false,
    );
  });
});
