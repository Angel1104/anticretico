-- Anticretico MVP schema. See /Users/angel/Ventures/anticretico-docs/canon/data-model.md.
-- Testnet-only. All USDC amounts are integers (Stellar uses 7 decimals; we store the display amount in USDC).

create type property_state as enum (
  'En fondeo',
  'En trámite',
  'Buscando inquilino',
  'Alquilado',
  'Finalizado'
);

create table properties (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  state property_state not null default 'En fondeo',
  ciudad text not null,
  barrio text not null,
  address text not null,
  target_usdc integer not null check (target_usdc > 0),
  rent_monthly_usdc integer not null check (rent_monthly_usdc >= 0),
  duration_months integer not null check (duration_months > 0),
  owner_wallet text,
  escrow_address text,
  token_series_code text,
  images_urls text[] not null default '{}',
  dr_inscription_date date,
  description text,
  created_at timestamptz not null default now()
);

create index properties_state_idx on properties(state);
create index properties_ciudad_idx on properties(ciudad);
create index properties_slug_idx on properties(slug);

-- Positions: investor holdings (real rows populated by ANT-INVEST).
create table positions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  investor_wallet text not null,
  tokens_held integer not null check (tokens_held > 0),
  usdc_invested integer not null check (usdc_invested > 0),
  deposited_tx text not null,
  created_at timestamptz not null default now()
);

create index positions_property_idx on positions(property_id);

-- Row-level security: properties are publicly readable (catalog is public).
alter table properties enable row level security;
create policy "properties are public readable" on properties for select using (true);

alter table positions enable row level security;
create policy "positions are public readable" on positions for select using (true);

-- Realtime: broadcast property state changes so the catalog updates without reload.
alter publication supabase_realtime add table properties;
