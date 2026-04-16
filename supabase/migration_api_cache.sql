-- API response cache tables.
-- Goal: every paid external API call (Google Places facilities, Yahoo
-- commute) is made at most ONCE per (station × params), then served from
-- Supabase for all future requests.

-- facility lookups: (station_code, types_sorted_csv) → JSON array of places
create table if not exists public.town_facilities_cache (
  station_code text not null,
  types_key text not null, -- sorted comma-joined type list, e.g. "cafe,hospital,park"
  data jsonb not null, -- array of {name, lat, lng, type, rating, address}
  fetched_at timestamptz not null default now(),
  primary key (station_code, types_key)
);

create index if not exists town_facilities_cache_fetched_at_idx
  on public.town_facilities_cache (fetched_at);

-- commute lookups: (from_station, to_station) → minutes
create table if not exists public.town_commutes_cache (
  from_station text not null,
  to_station text not null,
  minutes integer,
  fare integer,
  transfers integer,
  route jsonb,
  fetched_at timestamptz not null default now(),
  primary key (from_station, to_station)
);

create index if not exists town_commutes_cache_fetched_at_idx
  on public.town_commutes_cache (fetched_at);

-- Public read (any authenticated user can read cached data)
alter table public.town_facilities_cache enable row level security;
alter table public.town_commutes_cache enable row level security;

drop policy if exists "Read facilities cache" on public.town_facilities_cache;
create policy "Read facilities cache" on public.town_facilities_cache
  for select using (true);

drop policy if exists "Read commutes cache" on public.town_commutes_cache;
create policy "Read commutes cache" on public.town_commutes_cache
  for select using (true);
