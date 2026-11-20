import { supabase } from "@/lib/db/supabase";
import type { Property } from "@/lib/db/types";

export type OwnerPropertyRow = Property & {
  funded_usdc: number;
  investors_count: number;
};

export async function listOwnerProperties(ownerWallet: string): Promise<OwnerPropertyRow[]> {
  const { data: properties, error } = await supabase
    .from("properties")
    .select("*")
    .eq("owner_wallet", ownerWallet)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows: OwnerPropertyRow[] = [];
  for (const p of properties ?? []) {
    const { data: positions } = await supabase
      .from("positions")
      .select("investor_wallet, usdc_invested")
      .eq("property_id", p.id);
    const funded = (positions ?? []).reduce((s, r) => s + (r.usdc_invested ?? 0), 0);
    const investors = new Set((positions ?? []).map((r) => r.investor_wallet)).size;
    rows.push({ ...(p as Property), funded_usdc: funded, investors_count: investors });
  }
  return rows;
}
