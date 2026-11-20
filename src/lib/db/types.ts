export const PROPERTY_STATES = [
  "En fondeo",
  "En trámite",
  "Buscando inquilino",
  "Alquilado",
  "Finalizado",
] as const;

export type PropertyState = (typeof PROPERTY_STATES)[number];

export type Property = {
  id: string;
  slug: string;
  state: PropertyState;
  ciudad: string;
  barrio: string;
  address: string;
  target_usdc: number;
  rent_monthly_usdc: number;
  duration_months: number;
  owner_wallet: string | null;
  escrow_address: string | null;
  token_series_code: string | null;
  images_urls: string[];
  dr_inscription_date: string | null;
  description: string | null;
  created_at: string;
};

export type Position = {
  id: string;
  property_id: string;
  investor_wallet: string;
  tokens_held: number;
  usdc_invested: number;
  deposited_tx: string;
  created_at: string;
};
