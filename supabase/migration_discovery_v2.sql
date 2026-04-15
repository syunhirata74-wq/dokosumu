-- Discovery v2 Migration: 発見機能の改革
-- Run this in the Supabase SQL Editor after migration_prod.sql
-- Adds town_likes (who liked which town) and town_swipes (swipe history).

-- town_likes: one row per (couple, station, user). Both-LIKE = two rows.
create table if not exists public.town_likes (
  couple_id uuid not null references public.couples(id) on delete cascade,
  station_code text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (couple_id, station_code, user_id)
);

create index if not exists town_likes_couple_idx on public.town_likes (couple_id);
create index if not exists town_likes_user_idx on public.town_likes (user_id);

alter table public.town_likes enable row level security;

create policy "View town_likes" on public.town_likes for select
  using (couple_id = public.get_my_couple_id());
create policy "Insert own town_likes" on public.town_likes for insert
  with check (auth.uid() = user_id and couple_id = public.get_my_couple_id());
create policy "Delete own town_likes" on public.town_likes for delete
  using (auth.uid() = user_id);


-- town_swipes: records every swipe (left and right) for resumption + dedup.
create table if not exists public.town_swipes (
  couple_id uuid not null references public.couples(id) on delete cascade,
  station_code text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  direction text not null check (direction in ('left', 'right')),
  created_at timestamptz not null default now(),
  primary key (couple_id, station_code, user_id)
);

create index if not exists town_swipes_user_idx on public.town_swipes (user_id);

alter table public.town_swipes enable row level security;

create policy "View town_swipes" on public.town_swipes for select
  using (couple_id = public.get_my_couple_id());
create policy "Upsert own town_swipes" on public.town_swipes for insert
  with check (auth.uid() = user_id and couple_id = public.get_my_couple_id());
create policy "Update own town_swipes" on public.town_swipes for update
  using (auth.uid() = user_id);
create policy "Delete own town_swipes" on public.town_swipes for delete
  using (auth.uid() = user_id);
