-- Escrow lifecycle events: release, refund, distribution refs, etc.

create table escrow_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  kind text not null check (kind in ('released', 'returned', 'funded')),
  usdc_amount integer not null check (usdc_amount > 0),
  stellar_tx text not null,
  admin_wallet text,
  dr_milestone_at timestamptz,
  created_at timestamptz not null default now()
);

create index escrow_events_property_idx on escrow_events(property_id);

alter table escrow_events enable row level security;
create policy "escrow events are public readable" on escrow_events for select using (true);

alter publication supabase_realtime add table escrow_events;

-- Distributions: monthly Pollar payouts to token holders.
create table distributions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  period_month date not null,
  gross_usdc integer not null,
  fee_usdc integer not null,
  net_usdc integer not null,
  holders_count integer not null,
  stellar_tx text not null,
  created_at timestamptz not null default now()
);

create index distributions_property_idx on distributions(property_id);
create index distributions_period_idx on distributions(property_id, period_month);

alter table distributions enable row level security;
create policy "distributions are public readable" on distributions for select using (true);

alter publication supabase_realtime add table distributions;
