// @vitest-environment node
/**
 * Tests releaseEscrow around the USDC trustline gate: if the owner wallet does
 * not have a trustline to USDC, the action must throw OwnerNoTrustlineError
 * with the i18n key as the message, and the on-chain serverPayment must NOT
 * have been called.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";

const ISSUER = Keypair.random().publicKey();
const ADMIN = Keypair.random().publicKey();
const OWNER = Keypair.random().publicKey();
const ESCROW_KP = Keypair.random();

process.env.NEXT_PUBLIC_USDC_CODE = "USDC";
process.env.NEXT_PUBLIC_USDC_ISSUER = ISSUER;
process.env.NEXT_PUBLIC_ADMIN_WALLETS = ADMIN;
process.env.ESCROW_STUB_SECRET = ESCROW_KP.secret();

const remoteHasTrustlineMock = vi.fn();
const serverPaymentMock = vi.fn();

vi.mock("@/lib/stellar/server", () => ({
  remoteHasTrustline: remoteHasTrustlineMock,
  serverPayment: serverPaymentMock,
}));

type FakeTable = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

function fakeDb(property: Record<string, unknown> | null, positions: Array<{ usdc_invested: number }>) {
  const propTable = {
    select: vi.fn(() => propTable),
    eq: vi.fn(() => propTable),
    maybeSingle: vi.fn().mockResolvedValue({ data: property, error: null }),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockResolvedValue({ data: null, error: null }),
  } as unknown as FakeTable;

  const positionsResult = { data: positions, error: null };
  const posTable = {
    select: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue(positionsResult),
    })),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockResolvedValue({ data: null, error: null }),
  } as unknown as FakeTable;

  const escrowTable = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn(),
  } as unknown as FakeTable;

  const propertiesUpdateTable = {
    update: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "properties") {
        // The first call to properties is a select, later it's an update.
        // Return an object that supports both chains.
        return {
          select: propTable.select,
          update: propertiesUpdateTable.update,
        };
      }
      if (table === "positions") return posTable;
      if (table === "escrow_events") return escrowTable;
      throw new Error(`unexpected table ${table}`);
    }),
  };
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(),
  })),
}));

describe("releaseEscrow trustline gate", () => {
  beforeEach(() => {
    remoteHasTrustlineMock.mockReset();
    serverPaymentMock.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.invalid";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
  });

  it("throws OwnerNoTrustlineError with the i18n key when owner has no USDC trustline", async () => {
    const db = fakeDb(
      { owner_wallet: OWNER, slug: "casa-1" },
      [{ usdc_invested: 1000 }],
    );
    const { createClient } = await import("@supabase/supabase-js");
    (createClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(db);

    remoteHasTrustlineMock.mockResolvedValue(false);

    const { releaseEscrow, OwnerNoTrustlineError } = await import("../actions");
    await expect(
      releaseEscrow({ propertyId: "prop-1", adminWallet: ADMIN }),
    ).rejects.toBeInstanceOf(OwnerNoTrustlineError);
    try {
      await releaseEscrow({ propertyId: "prop-1", adminWallet: ADMIN });
    } catch (e) {
      expect((e as Error).message).toBe("admin.error.ownerNoTrustline");
    }

    expect(serverPaymentMock).not.toHaveBeenCalled();
  });

  it("proceeds to send USDC when the owner trustline is present", async () => {
    const db = fakeDb(
      { owner_wallet: OWNER, slug: "casa-1" },
      [{ usdc_invested: 500 }, { usdc_invested: 500 }],
    );
    const { createClient } = await import("@supabase/supabase-js");
    (createClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(db);

    remoteHasTrustlineMock.mockResolvedValue(true);
    serverPaymentMock.mockResolvedValue({ hash: "release-hash" });

    const { releaseEscrow } = await import("../actions");
    const out = await releaseEscrow({ propertyId: "prop-1", adminWallet: ADMIN });
    expect(out.hash).toBe("release-hash");
    expect(serverPaymentMock).toHaveBeenCalledWith(
      expect.objectContaining({ toPublic: OWNER, amountUsdc: 1000 }),
    );
  });
});
