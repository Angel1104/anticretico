create table rollovers (
  id uuid primary key default gen_random_uuid(),
  source_property_id uuid not null references properties(id) on delete cascade,
  target_property_id uuid not null references properties(id) on delete cascade,
  holders_migrated integer not null,
  usdc_migrated integer not null,
  stellar_tx text not null,
  initiated_by text not null,
  created_at timestamptz not null default now()
);

create index rollovers_source_idx on rollovers(source_property_id);
create index rollovers_target_idx on rollovers(target_property_id);

alter table rollovers enable row level security;
create policy "rollovers public readable" on rollovers for select using (true);

alter publication supabase_realtime add table rollovers;
