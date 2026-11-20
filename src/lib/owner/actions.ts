"use server";

import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function recordOwnerAction(params: {
  propertyId: string;
  ownerWallet: string;
  kind: "withdraw" | "defi_deposit" | "mixed";
  withdrawUsdc: number;
  defiUsdc: number;
  stellarTx: string;
}) {
  const db = supabaseAdmin();

  const { data: property, error } = await db
    .from("properties")
    .select("owner_wallet")
    .eq("id", params.propertyId)
    .maybeSingle();
  if (error) throw error;
  if (!property) throw new Error("Property not found.");
  if (property.owner_wallet !== params.ownerWallet) {
    throw new Error("Only the property owner can record owner actions.");
  }

  const { data, error: insErr } = await db
    .from("owner_actions")
    .insert({
      property_id: params.propertyId,
      owner_wallet: params.ownerWallet,
      kind: params.kind,
      withdraw_usdc: params.withdrawUsdc,
      defi_usdc: params.defiUsdc,
      defi_protocol: params.defiUsdc > 0 ? "blend_stub" : null,
      stellar_tx: params.stellarTx,
    })
    .select()
    .single();
  if (insErr) throw insErr;
  return data;
}
