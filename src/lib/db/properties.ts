import { supabase } from "./supabase";
import type { Property } from "./types";

export async function listProperties(): Promise<Property[]> {
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Property[];
}

export async function getPropertyBySlug(slug: string): Promise<Property | null> {
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data as Property | null;
}

export async function getFundedUsdcForProperty(propertyId: string): Promise<number> {
  const { data, error } = await supabase
    .from("positions")
    .select("usdc_invested")
    .eq("property_id", propertyId);
  if (error) throw error;
  return (data ?? []).reduce((sum, row) => sum + (row.usdc_invested ?? 0), 0);
}

export async function countInvestorsForProperty(propertyId: string): Promise<number> {
  const { data, error } = await supabase
    .from("positions")
    .select("investor_wallet")
    .eq("property_id", propertyId);
  if (error) throw error;
  const unique = new Set((data ?? []).map((row) => row.investor_wallet));
  return unique.size;
}
