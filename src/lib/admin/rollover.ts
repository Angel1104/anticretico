"use server";

import { createClient } from "@supabase/supabase-js";
import { serverPayment } from "@/lib/stellar/server";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Migrate holders from source (Finalizado) to target (En fondeo).
 *
 * Demo semantics (documented in canon/mvp.md): holder wallets are controlled
 * by the SRL in this pilot, so the migration is batch-signed from the escrow
 * account. Real-world opt-in per-holder signatures are a post-pilot epic.
 *
 * Mechanics:
 *  - Mirror each source position into the target with the same USDC amount
 *  - Fire a single bookkeeping tx from the escrow account (0 XLM memo-only
 *    would require a payment op; we send 1 stroop to the target's own
 *    escrow to produce a verifiable on-chain anchor for the composite tx)
 *  - Delete source positions (burn tokens)
 *  - Transition source state to Finalizado if not already (expected it is)
 *  - Record rollovers row
 */
export async function rolloverHolders(params: {
  sourcePropertyId: string;
  targetPropertyId: string;
  adminWallet: string;
}): Promise<{
  hash: string;
  holdersMigrated: number;
  usdcMigrated: number;
}> {
  const { sourcePropertyId, targetPropertyId, adminWallet } = params;

  const allowList = (process.env.NEXT_PUBLIC_ADMIN_WALLETS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!allowList.includes(adminWallet)) {
    throw new Error("Wallet not authorised for admin actions.");
  }

  const escrowSecret = process.env.ESCROW_STUB_SECRET;
  if (!escrowSecret) throw new Error("Escrow secret not configured.");

  const db = supabaseAdmin();

  const { data: source, error: sErr } = await db
    .from("properties")
    .select("*")
    .eq("id", sourcePropertyId)
    .maybeSingle();
  if (sErr) throw sErr;
  if (!source) throw new Error("Source property not found.");

  const { data: target, error: tErr } = await db
    .from("properties")
    .select("*")
    .eq("id", targetPropertyId)
    .maybeSingle();
  if (tErr) throw tErr;
  if (!target) throw new Error("Target property not found.");
  if (target.state !== "En fondeo") {
    throw new Error(
      `Target must be 'En fondeo' to receive rollover. Current: ${target.state}`,
    );
  }
  if (!target.escrow_address) {
    throw new Error("Target property has no escrow address.");
  }

  const { data: sourcePositions, error: pErr } = await db
    .from("positions")
    .select("*")
    .eq("property_id", sourcePropertyId);
  if (pErr) throw pErr;
  if (!sourcePositions || sourcePositions.length === 0) {
    throw new Error("No positions to migrate.");
  }

  const totalUsdc = sourcePositions.reduce(
    (s, p) => s + (p.usdc_invested ?? 0),
    0,
  );
  if (totalUsdc <= 0) throw new Error("Total USDC is zero.");
  if (totalUsdc > (target.target_usdc ?? 0)) {
    throw new Error(
      `Target has capacity ${target.target_usdc} USDC but rollover is ${totalUsdc} USDC.`,
    );
  }

  // Anchor tx on-chain: escrow sends 1 stroop (0.0000001 XLM) to the target
  // escrow with a memo identifying the rollover. This is the canonical on-chain
  // marker; the actual bookkeeping is in Supabase. Real-world will replace this
  // with a Soroban rollover contract call.
  const res = await serverPayment({
    fromSecret: escrowSecret,
    toPublic: target.escrow_address,
    amountUsdc: 0.0000001,
    memo: `rol:${source.slug.slice(0, 20)}`,
  });

  // Insert mirror positions on the target
  const mirrored = sourcePositions.map((p) => ({
    property_id: targetPropertyId,
    investor_wallet: p.investor_wallet,
    tokens_held: p.tokens_held,
    usdc_invested: p.usdc_invested,
    deposited_tx: res.hash,
  }));
  const { error: insErr } = await db.from("positions").insert(mirrored);
  if (insErr) throw insErr;

  // Burn source positions
  const { error: delErr } = await db
    .from("positions")
    .delete()
    .eq("property_id", sourcePropertyId);
  if (delErr) throw delErr;

  // Record the rollover
  await db.from("rollovers").insert({
    source_property_id: sourcePropertyId,
    target_property_id: targetPropertyId,
    holders_migrated: sourcePositions.length,
    usdc_migrated: totalUsdc,
    stellar_tx: res.hash,
    initiated_by: adminWallet,
  });

  // Ensure source stays Finalizado
  if (source.state !== "Finalizado") {
    await db
      .from("properties")
      .update({ state: "Finalizado" })
      .eq("id", sourcePropertyId);
  }

  return {
    hash: res.hash,
    holdersMigrated: sourcePositions.length,
    usdcMigrated: totalUsdc,
  };
}

export async function listRolloverCandidates() {
  const db = supabaseAdmin();

  const { data: sources, error: sErr } = await db
    .from("properties")
    .select("*")
    .eq("state", "Finalizado");
  if (sErr) throw sErr;

  const { data: targets, error: tErr } = await db
    .from("properties")
    .select("*")
    .eq("state", "En fondeo");
  if (tErr) throw tErr;

  return { sources: sources ?? [], targets: targets ?? [] };
}
