"use server";

import { createClient } from "@supabase/supabase-js";
import { serverPayment } from "@/lib/stellar/server";

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
