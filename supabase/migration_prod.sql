-- Production Migration: どこ住む？
-- Run this in the Supabase SQL Editor

create extension if not exists "uuid-ossp";

create table public.couples (id uuid primary key default uuid_generate_v4(), invite_code text unique not null default substr(md5(random()::text), 1, 8), created_at timestamptz not null default now());
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, couple_id uuid references public.couples(id) on delete set null, name text not null, avatar_url text, workplace_station text, workplace_station_code text, created_at timestamptz not null default now());
create table public.towns (id uuid primary key default uuid_generate_v4(), couple_id uuid not null references public.couples(id) on delete cascade, name text not null, station text, station_code text, visited_at date, visited boolean not null default true, lat double precision not null default 0, lng double precision not null default 0, created_at timestamptz not null default now());
create table public.spots (id uuid primary key default uuid_generate_v4(), town_id uuid not null references public.towns(id) on delete cascade, name text not null, category text not null default 'other', memo text, photo_url text, lat double precision, lng double precision, created_at timestamptz not null default now());
create table public.ratings (id uuid primary key default uuid_generate_v4(), town_id uuid not null references public.towns(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade, living_env int not null check (living_env between 1 and 5), transport int not null check (transport between 1 and 5), shopping int not null check (shopping between 1 and 5), nature int not null check (nature between 1 and 5), dining int not null check (dining between 1 and 5), rent int not null check (rent between 1 and 5), overall int not null check (overall between 1 and 5), created_at timestamptz not null default now(), unique(town_id, user_id));
create table public.town_comments (id uuid primary key default uuid_generate_v4(), town_id uuid not null references public.towns(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade, content text not null, created_at timestamptz not null default now());
create table public.spot_favorites (id uuid primary key default uuid_generate_v4(), spot_id uuid not null references public.spots(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade, created_at timestamptz not null default now(), unique(spot_id, user_id));
create table public.town_rents (id uuid primary key default uuid_generate_v4(), town_id uuid not null references public.towns(id) on delete cascade, rent_avg integer, fetched_at timestamptz not null default now(), unique(town_id));
create table public.couple_conditions (id uuid primary key default uuid_generate_v4(), couple_id uuid not null references public.couples(id) on delete cascade, label text not null, icon text not null default '📋', sort_order int not null default 0, created_at timestamptz not null default now());
create table public.condition_priorities (id uuid primary key default uuid_generate_v4(), condition_id uuid not null references public.couple_conditions(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade, weight int not null default 3 check (weight between 1 and 5), created_at timestamptz not null default now(), unique(condition_id, user_id));
create table public.town_recommendations (id uuid primary key default uuid_generate_v4(), town_id uuid not null references public.towns(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade, created_at timestamptz not null default now(), unique(town_id, user_id));

create or replace function public.get_my_couple_id() returns uuid language sql security definer stable as $$ select couple_id from public.profiles where id = auth.uid() $$;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer as $$ begin insert into public.profiles (id, name) values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))) on conflict (id) do nothing; return new; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.couples enable row level security;
alter table public.profiles enable row level security;
alter table public.towns enable row level security;
alter table public.spots enable row level security;
alter table public.ratings enable row level security;
alter table public.town_comments enable row level security;
alter table public.spot_favorites enable row level security;
alter table public.town_rents enable row level security;
alter table public.couple_conditions enable row level security;
alter table public.condition_priorities enable row level security;
alter table public.town_recommendations enable row level security;

create policy "View profiles" on public.profiles for select using (auth.uid() = id or (couple_id is not null and couple_id = public.get_my_couple_id()));
create policy "Update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "View couples" on public.couples for select using (true);
create policy "Create couples" on public.couples for insert with check (auth.uid() is not null);
create policy "View towns" on public.towns for select using (couple_id = public.get_my_couple_id());
create policy "Insert towns" on public.towns for insert with check (couple_id = public.get_my_couple_id());
create policy "Update towns" on public.towns for update using (couple_id = public.get_my_couple_id());
create policy "Delete towns" on public.towns for delete using (couple_id = public.get_my_couple_id());
create policy "View spots" on public.spots for select using (town_id in (select id from public.towns where couple_id = public.get_my_couple_id()));
create policy "Insert spots" on public.spots for insert with check (town_id in (select id from public.towns where couple_id = public.get_my_couple_id()));
create policy "Delete spots" on public.spots for delete using (town_id in (select id from public.towns where couple_id = public.get_my_couple_id()));
create policy "View ratings" on public.ratings for select using (town_id in (select id from public.towns where couple_id = public.get_my_couple_id()));
create policy "Insert ratings" on public.ratings for insert with check (auth.uid() = user_id);
create policy "Update ratings" on public.ratings for update using (auth.uid() = user_id);
create policy "View comments" on public.town_comments for select using (town_id in (select id from public.towns where couple_id = public.get_my_couple_id()));
create policy "Insert comments" on public.town_comments for insert with check (auth.uid() = user_id);
create policy "Delete comments" on public.town_comments for delete using (auth.uid() = user_id);
create policy "View favorites" on public.spot_favorites for select using (spot_id in (select s.id from public.spots s join public.towns t on s.town_id = t.id where t.couple_id = public.get_my_couple_id()));
create policy "Insert favorites" on public.spot_favorites for insert with check (auth.uid() = user_id);
create policy "Delete favorites" on public.spot_favorites for delete using (auth.uid() = user_id);
create policy "View rents" on public.town_rents for select using (town_id in (select id from public.towns where couple_id = public.get_my_couple_id()));
create policy "Insert rents" on public.town_rents for insert with check (town_id in (select id from public.towns where couple_id = public.get_my_couple_id()));
create policy "Update rents" on public.town_rents for update using (town_id in (select id from public.towns where couple_id = public.get_my_couple_id()));
create policy "View conditions" on public.couple_conditions for select using (couple_id = public.get_my_couple_id());
create policy "Insert conditions" on public.couple_conditions for insert with check (couple_id = public.get_my_couple_id());
create policy "Update conditions" on public.couple_conditions for update using (couple_id = public.get_my_couple_id());
create policy "Delete conditions" on public.couple_conditions for delete using (couple_id = public.get_my_couple_id());
create policy "View priorities" on public.condition_priorities for select using (condition_id in (select id from public.couple_conditions where couple_id = public.get_my_couple_id()));
create policy "Insert priorities" on public.condition_priorities for insert with check (auth.uid() = user_id);
create policy "Update priorities" on public.condition_priorities for update using (auth.uid() = user_id);
create policy "View recommendations" on public.town_recommendations for select using (town_id in (select id from public.towns where couple_id = public.get_my_couple_id()));
create policy "Insert recommendations" on public.town_recommendations for insert with check (auth.uid() = user_id);
create policy "Delete recommendations" on public.town_recommendations for delete using (auth.uid() = user_id);

insert into storage.buckets (id, name, public) values ('spot-photos', 'spot-photos', true) on conflict do nothing;
create policy "Upload photos" on storage.objects for insert with check (bucket_id = 'spot-photos' and auth.uid() is not null);
create policy "View photos" on storage.objects for select using (bucket_id = 'spot-photos');
