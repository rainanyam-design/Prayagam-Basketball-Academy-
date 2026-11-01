-- Prayagam Basketball Academy: run this whole file in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('coach','player')),
  player_id uuid unique
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dob date,
  height text,
  position text,
  jersey_number text,
  phone text,
  photo_url text,
  created_at timestamptz default now()
);
alter table public.profiles drop constraint if exists profiles_player_id_fkey;
alter table public.profiles add constraint profiles_player_id_fkey foreign key(player_id) references public.players(id) on delete set null;

create table if not exists public.academy_settings (
  id integer primary key default 1 check (id=1),
  name text not null default 'Prayagam Basketball Academy',
  location text,
  coach text,
  phone text,
  timings text,
  logo_url text
);
insert into public.academy_settings(id,name,location,coach,phone,timings)
values(1,'Prayagam Basketball Academy','53 Anukool Chandra, Collenganj Intermediate College, Opposite Phoenix Hospital, Colonelganj, Prayagraj, Uttar Pradesh - 211002.','Saurabh Kumar','+91 63078 25498','Add training days and timings from the coach portal.')
on conflict(id) do nothing;

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  session_date date not null default current_date,
  status text not null check(status in ('Present','Absent','Late')),
  created_at timestamptz default now()
);
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_date date,
  venue text,
  result text,
  created_at timestamptz default now()
);
create table if not exists public.fees (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  month text not null,
  amount numeric(10,2) not null default 600,
  status text not null check(status in ('Paid','Pending')),
  created_at timestamptz default now()
);
create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  title text,
  media_url text not null,
  media_type text not null check(media_type in ('image','video')),
  created_at timestamptz default now()
);
create table if not exists public.seniors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  batch text,
  achievement text,
  photo_url text,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create or replace function public.is_coach()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where user_id=auth.uid() and role='coach'); $$;

alter table public.profiles enable row level security;
alter table public.players enable row level security;
alter table public.academy_settings enable row level security;
alter table public.attendance enable row level security;
alter table public.tournaments enable row level security;
alter table public.fees enable row level security;
alter table public.gallery enable row level security;
alter table public.seniors enable row level security;

-- Enforce the requested account capacity: maximum 2 coach logins and 70 player logins.
create or replace function public.enforce_academy_account_limits()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.role is distinct from old.role) then
    if new.role = 'coach' and (select count(*) from public.profiles where role='coach' and user_id <> coalesce(new.user_id,'00000000-0000-0000-0000-000000000000')) >= 2 then
      raise exception 'Prayagam Academy already has its 2 coach accounts.';
    end if;
    if new.role = 'player' and (select count(*) from public.profiles where role='player' and user_id <> coalesce(new.user_id,'00000000-0000-0000-0000-000000000000')) >= 70 then
      raise exception 'Prayagam Academy has reached its 70 player account limit.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists academy_account_capacity on public.profiles;
create trigger academy_account_capacity before insert or update of role on public.profiles
for each row execute function public.enforce_academy_account_limits();

-- Profiles: users see their own profile; coaches manage role assignments.
create policy "profile read self or coach" on public.profiles for select to authenticated using(user_id=auth.uid() or public.is_coach());
create policy "coach manages profiles" on public.profiles for all to authenticated using(public.is_coach()) with check(public.is_coach());

-- Players: authenticated members can view the directory; coaches alone edit it.
create policy "members read players" on public.players for select to authenticated using(true);
-- Public directory is exposed through a restricted view, not the full players table.
create or replace view public.public_player_directory as
  select id, name, photo_url from public.players;
grant select on public.public_player_directory to anon, authenticated;
create policy "coach manages players" on public.players for all to authenticated using(public.is_coach()) with check(public.is_coach());

create policy "members read academy settings" on public.academy_settings for select to authenticated using(true);
create policy "public reads academy settings" on public.academy_settings for select to anon using(true);
create policy "coach edits academy settings" on public.academy_settings for all to authenticated using(public.is_coach()) with check(public.is_coach());

create policy "players read own attendance and coaches read all" on public.attendance for select to authenticated using(public.is_coach() or player_id=(select player_id from public.profiles where user_id=auth.uid()));
create policy "coach manages attendance" on public.attendance for all to authenticated using(public.is_coach()) with check(public.is_coach());
create policy "members read tournaments" on public.tournaments for select to authenticated using(true);
create policy "public reads tournaments" on public.tournaments for select to anon using(true);
create policy "coach manages tournaments" on public.tournaments for all to authenticated using(public.is_coach()) with check(public.is_coach());
create policy "members read fees" on public.fees for select to authenticated using(public.is_coach() or player_id=(select player_id from public.profiles where user_id=auth.uid()));
create policy "coach manages fees" on public.fees for all to authenticated using(public.is_coach()) with check(public.is_coach());
create policy "members read gallery" on public.gallery for select to authenticated using(true);
create policy "public reads gallery" on public.gallery for select to anon using(true);
create policy "coach manages gallery" on public.gallery for all to authenticated using(public.is_coach()) with check(public.is_coach());
create policy "members read seniors" on public.seniors for select to authenticated using(true);
create policy "public reads seniors" on public.seniors for select to anon using(true);
create policy "coach manages seniors" on public.seniors for all to authenticated using(public.is_coach()) with check(public.is_coach());

-- Private member portal: no public account registration is enabled by this app.
-- Coaches create/invite accounts in Supabase Authentication, then insert profiles.
-- To provision a player: create the players row, create/invite the Auth user,
-- then insert profiles(user_id,display_name,role,player_id).
-- To provision a coach: create/invite Auth user, then insert profiles(user_id,display_name,role)
-- with role='coach'. Create exactly two coach profiles and up to 70 player profiles.
-- Do not expose the Supabase service_role key in this website.
