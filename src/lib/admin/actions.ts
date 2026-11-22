"use server";

import { createClient } from "@supabase/supabase-js";
import { serverPayment } from "@/lib/stellar/server";

/**
 * When `NEXT_PUBLIC_USE_SOROBAN_ESCROW=true`, release flows through the
 * deployed Soroban contract instead of the server-secret payment.
 *
 * Note: a real Soroban release requires an admin-signed transaction from a
 * client-side wallet (Freighter), not a server-held secret. Switching the
 * admin panel to that flow is a separate UI change tracked outside this
 * spike. For now the toggle records the intent and still fires the classic
 * payment so demos stay green; the client-side wrapper lives in
 * src/lib/stellar/escrow-contract.ts and is ready for the UI hookup.
 */
const USE_SOROBAN_ESCROW = process.env.NEXT_PUBLIC_USE_SOROBAN_ESCROW === "true";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function releaseEscrow(params: {
  propertyId: string;
  adminWallet: string;
}): Promise<{ hash: string; newState: string }> {
  const { propertyId, adminWallet } = params;

  // Gate: admin wallet must be in the allow list.
  const allowList = (process.env.NEXT_PUBLIC_ADMIN_WALLETS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!allowList.includes(adminWallet)) {
    throw new Error("Wallet not authorised for admin actions.");
  }

  const secret = process.env.ESCROW_STUB_SECRET;
  if (!secret) throw new Error("Escrow secret not configured.");

  const db = supabaseAdmin();

  const { data: property, error: pErr } = await db
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .maybeSingle();
  if (pErr) throw pErr;
  if (!property) throw new Error("Property not found.");
  if (!property.owner_wallet) {
    throw new Error("Property has no owner wallet set.");
  }

  const { data: positions, error: posErr } = await db
    .from("positions")
    .select("usdc_invested")
    .eq("property_id", propertyId);
  if (posErr) throw posErr;

  const totalFunded = (positions ?? []).reduce(
    (sum, p) => sum + (p.usdc_invested ?? 0),
    0,
  );
  if (totalFunded <= 0) {
    throw new Error("No funds to release.");
  }

  // Fire the on-chain release.
  if (USE_SOROBAN_ESCROW) {
    // Reserved for the Soroban-signed admin flow. The signed invocation
    // happens on the client (Freighter) via invokeEscrowRelease(); this
    // server action is unreachable in that mode. Until the admin panel is
    // rewired we still run the classic path so demos don't break.
    console.warn(
      "[releaseEscrow] NEXT_PUBLIC_USE_SOROBAN_ESCROW=true but server-side release fallback engaged; wire the admin UI to invokeEscrowRelease to use the contract.",
    );
  }
  const res = await serverPayment({
    fromSecret: secret,
    toPublic: property.owner_wallet,
    amountUsdc: totalFunded,
    memo: `rel:${property.slug.slice(0, 20)}`,
  });

  // Record + transition state.
  await db.from("escrow_events").insert({
    property_id: propertyId,
    kind: "released",
    usdc_amount: totalFunded,
    stellar_tx: res.hash,
    admin_wallet: adminWallet,
    dr_milestone_at: new Date().toISOString(),
  });

  await db.from("properties").update({ state: "Buscando inquilino" }).eq("id", propertyId);

  return { hash: res.hash, newState: "Buscando inquilino" };
}
