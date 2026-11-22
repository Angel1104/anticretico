"use server";

import { createClient } from "@supabase/supabase-js";
import { remoteHasTrustline, serverBatchPayment } from "@/lib/stellar/server";
import { IS_USDC_CONFIGURED } from "@/lib/stellar/network";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

const PLATFORM_FEE_BPS = 1500; // 15.00%

export async function distributeMonthlyRent(params: {
  propertyId: string;
  adminWallet: string;
}): Promise<{
  hash: string;
  grossUsdc: number;
  netUsdc: number;
  holdersCount: number;
  skippedHolders: string[];
}> {
  const { propertyId, adminWallet } = params;

  const allowList = (process.env.NEXT_PUBLIC_ADMIN_WALLETS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!allowList.includes(adminWallet)) {
    throw new Error("Wallet not authorised for admin actions.");
  }

  const distributorSecret = process.env.DISTRIBUTOR_SECRET;
  if (!distributorSecret) throw new Error("Distributor secret not configured.");

  const db = supabaseAdmin();

  const { data: property, error: pErr } = await db
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .maybeSingle();
  if (pErr) throw pErr;
  if (!property) throw new Error("Property not found.");
  if (property.state !== "Alquilado" && property.state !== "Buscando inquilino") {
    throw new Error(
      `Property state is '${property.state}'. Distributions require 'Alquilado' (or 'Buscando inquilino' for the demo).`,
    );
  }

  const { data: positions, error: posErr } = await db
    .from("positions")
    .select("investor_wallet, usdc_invested")
    .eq("property_id", propertyId);
  if (posErr) throw posErr;

  if (!positions || positions.length === 0) {
    throw new Error("No holders to distribute to.");
  }

  const totalInvested = positions.reduce((s, p) => s + (p.usdc_invested ?? 0), 0);
  const grossUsdc = property.rent_monthly_usdc;
  const feeUsdc = Math.floor((grossUsdc * PLATFORM_FEE_BPS) / 10000);
  const netUsdc = grossUsdc - feeUsdc;

  // Allocate by pro-rata. Use smallest unit = 1 USDC for simplicity (whole amounts).
  // Any rounding remainder stays with the distributor (platform retained).
  const perHolder = new Map<string, number>();
  for (const p of positions) {
    if (perHolder.has(p.investor_wallet)) {
      perHolder.set(
        p.investor_wallet,
        (perHolder.get(p.investor_wallet) ?? 0) + (p.usdc_invested ?? 0),
      );
    } else {
      perHolder.set(p.investor_wallet, p.usdc_invested ?? 0);
    }
  }

  // Filter out holders without a USDC trustline: we can't pay them, but the
  // rest of the distribution proceeds. Skipped wallets are returned to the
  // caller so the admin UI can tell them which investors need to open one.
  const skippedHolders: string[] = [];
  const payableWallets = new Map<string, number>();
  if (IS_USDC_CONFIGURED) {
    for (const [wallet, tokens] of perHolder) {
      const ok = await remoteHasTrustline(wallet).catch(() => false);
      if (ok) {
        payableWallets.set(wallet, tokens);
      } else {
        skippedHolders.push(wallet);
      }
    }
  } else {
    for (const [wallet, tokens] of perHolder) {
      payableWallets.set(wallet, tokens);
    }
  }

  const payouts: Array<{ toPublic: string; amountUsdc: number }> = [];
  let allocated = 0;
  for (const [wallet, tokens] of payableWallets) {
    const share = Math.floor((netUsdc * tokens) / totalInvested);
    if (share > 0) {
      payouts.push({ toPublic: wallet, amountUsdc: share });
      allocated += share;
    }
  }

  if (payouts.length === 0) {
    throw new Error("Allocated amount per holder rounded to zero.");
  }

  // Stellar hard-limits a transaction to 100 operations. In practice the MVP
  // never has that many holders per property; if it ever did, batch here.
  if (payouts.length > 100) {
    throw new Error("Too many holders for a single tx; batching not implemented.");
  }

  const period = new Date();
  const periodMonth = `${period.getFullYear()}-${String(period.getMonth() + 1).padStart(2, "0")}-01`;

  const res = await serverBatchPayment({
    fromSecret: distributorSecret,
    payments: payouts,
    memo: `dis:${property.slug.slice(0, 20)}`,
  });

  await db.from("distributions").insert({
    property_id: propertyId,
    period_month: periodMonth,
    gross_usdc: grossUsdc,
    fee_usdc: feeUsdc + (netUsdc - allocated),
    net_usdc: allocated,
    holders_count: payouts.length,
    stellar_tx: res.hash,
  });

  // On first distribution, auto-advance to Alquilado.
  if (property.state !== "Alquilado") {
    await db.from("properties").update({ state: "Alquilado" }).eq("id", propertyId);
  }

  return {
    hash: res.hash,
    grossUsdc,
    netUsdc: allocated,
    holdersCount: payouts.length,
    skippedHolders,
  };
}
