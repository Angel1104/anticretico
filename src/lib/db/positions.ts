"use server";

import { createClient } from "@supabase/supabase-js";

export type RecordPositionInput = {
  propertyId: string;
  investorWallet: string;
  usdcInvested: number;
  tokensHeld: number;
  depositedTx: string;
};

export async function recordPosition(input: RecordPositionInput) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase env vars missing on server");
  }
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await admin
    .from("positions")
    .insert({
      property_id: input.propertyId,
      investor_wallet: input.investorWallet,
      usdc_invested: input.usdcInvested,
      tokens_held: input.tokensHeld,
      deposited_tx: input.depositedTx,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to record position: ${error.message}`);
  }
  return data;
}
