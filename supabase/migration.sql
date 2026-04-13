-- Supabase Migration: どこ住みたいんですか？
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Couples table
create table public.couples (
  id uuid primary key default uuid_generate_v4(),
  invite_code text unique not null default substr(md5(random()::text), 1, 8),
  created_at timestamptz not null default now()
);

-- Profiles table
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  couple_id uuid references public.couples(id) on delete set null,
  name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Towns table
create table public.towns (
  id uuid primary key default uuid_generate_v4(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  name text not null,
  station text,
  visited_at date not null default current_date,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now()
);

-- Spots table
create table public.spots (
  id uuid primary key default uuid_generate_v4(),
  town_id uuid not null references public.towns(id) on delete cascade,
  name text not null,
  category text not null default 'other',
  memo text,
  photo_url text,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

-- Ratings table
create table public.ratings (
  id uuid primary key default uuid_generate_v4(),
  town_id uuid not null references public.towns(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  living_env int not null check (living_env between 1 and 5),
  transport int not null check (transport between 1 and 5),
  shopping int not null check (shopping between 1 and 5),
  nature int not null check (nature between 1 and 5),
  dining int not null check (dining between 1 and 5),
  rent int not null check (rent between 1 and 5),
  overall int not null check (overall between 1 and 5),
  created_at timestamptz not null default now(),
  unique(town_id, user_id)
);

-- Row Level Security
alter table public.couples enable row level security;
alter table public.profiles enable row level security;
alter table public.towns enable row level security;
alter table public.spots enable row level security;
alter table public.ratings enable row level security;

-- Policies: profiles
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can view couple members"
  on public.profiles for select
  using (couple_id in (select couple_id from public.profiles where id = auth.uid()));

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Policies: couples
create policy "Couple members can view their couple"
  on public.couples for select
  using (id in (select couple_id from public.profiles where id = auth.uid()));

create policy "Authenticated users can create couples"
  on public.couples for insert
  with check (auth.uid() is not null);

-- Allow anyone to read couples by invite_code (for joining)
create policy "Anyone can look up couple by invite code"
  on public.couples for select
  using (true);

-- Policies: towns
create policy "Couple members can view towns"
  on public.towns for select
  using (couple_id in (select couple_id from public.profiles where id = auth.uid()));

create policy "Couple members can insert towns"
  on public.towns for insert
  with check (couple_id in (select couple_id from public.profiles where id = auth.uid()));

create policy "Couple members can update towns"
  on public.towns for update
  using (couple_id in (select couple_id from public.profiles where id = auth.uid()));

create policy "Couple members can delete towns"
  on public.towns for delete
  using (couple_id in (select couple_id from public.profiles where id = auth.uid()));

-- Policies: spots
create policy "Couple members can view spots"
  on public.spots for select
  using (town_id in (
    select id from public.towns
    where couple_id in (select couple_id from public.profiles where id = auth.uid())
  ));

create policy "Couple members can insert spots"
  on public.spots for insert
  with check (town_id in (
    select id from public.towns
    where couple_id in (select couple_id from public.profiles where id = auth.uid())
  ));

create policy "Couple members can delete spots"
  on public.spots for delete
  using (town_id in (
    select id from public.towns
    where couple_id in (select couple_id from public.profiles where id = auth.uid())
  ));

-- Policies: ratings
create policy "Couple members can view ratings"
  on public.ratings for select
  using (town_id in (
    select id from public.towns
    where couple_id in (select couple_id from public.profiles where id = auth.uid())
  ));

create policy "Users can insert own ratings"
  on public.ratings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own ratings"
  on public.ratings for update
  using (auth.uid() = user_id);

-- Storage bucket for spot photos
insert into storage.buckets (id, name, public)
values ('spot-photos', 'spot-photos', true)
on conflict do nothing;

create policy "Authenticated users can upload photos"
  on storage.objects for insert
  with check (bucket_id = 'spot-photos' and auth.uid() is not null);

create policy "Anyone can view photos"
  on storage.objects for select
  using (bucket_id = 'spot-photos');
