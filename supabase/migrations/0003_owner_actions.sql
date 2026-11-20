create table owner_actions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  owner_wallet text not null,
  kind text not null check (kind in ('withdraw', 'defi_deposit', 'mixed')),
  withdraw_usdc integer not null default 0,
  defi_usdc integer not null default 0,
  defi_protocol text,
  stellar_tx text not null,
  created_at timestamptz not null default now()
);

create index owner_actions_property_idx on owner_actions(property_id);
create index owner_actions_wallet_idx on owner_actions(owner_wallet);

alter table owner_actions enable row level security;
create policy "owner actions public readable" on owner_actions for select using (true);

alter publication supabase_realtime add table owner_actions;
