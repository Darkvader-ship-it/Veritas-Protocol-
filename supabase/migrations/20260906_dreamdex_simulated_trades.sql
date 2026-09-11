-- DreamDEX simulated trades (paper trading on Veritas' native prediction market)
-- Run this in your Supabase SQL editor before using the DreamDEX simulator.
create table if not exists public.dreamdex_simulated_trades (
  id bigserial primary key,
  follower text not null,
  market_id bigint not null,
  packaged_token_id bigint not null,
  question text not null,
  outcome_label text not null default 'Yes',
  outcome text not null default 'pending' check (outcome in ('pending', 'win', 'loss')),
  amount_usd numeric not null,
  price_at_entry numeric not null,
  potential_payout numeric not null,
  pnl_usd numeric,
  close_time timestamptz,
  simulated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_dreamdex_sim_follower on public.dreamdex_simulated_trades (follower);
create index if not exists idx_dreamdex_sim_market on public.dreamdex_simulated_trades (market_id);