-- ROBUX PLAY production schema (Supabase SQL Editor에서 전체 실행)
-- Supabase Authentication > Providers > Anonymous Sign-Ins 를 먼저 활성화하세요.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 16),
  show_on_board boolean not null default false,
  referral_code text not null unique default upper(substr(encode(gen_random_bytes(6),'hex'),1,8)),
  referred_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint profiles_name_format check (display_name ~ '^[가-힣a-zA-Z0-9_]+$')
);
create unique index if not exists profiles_display_name_lower_uq on public.profiles (lower(display_name));

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  partner_name text not null check (char_length(partner_name) between 1 and 60),
  title text not null check (char_length(title) between 1 and 90),
  description text not null check (char_length(description) between 1 and 500),
  destination_url text not null check (destination_url ~ '^https://'),
  disclosure text not null check (char_length(disclosure) between 1 and 180),
  minor_approved boolean not null default false,
  status text not null default 'draft' check (status in ('draft','published','paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_clicks (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  clicked_at timestamptz not null default now()
);
create index if not exists campaign_clicks_campaign_time_idx on public.campaign_clicks(campaign_id, clicked_at desc);

create or replace function public.is_my_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.admins where user_id = auth.uid()); $$;

create or replace function public.save_my_profile(p_display_name text, p_show_on_board boolean default false, p_referral_code text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare referrer uuid;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if p_display_name !~ '^[가-힣a-zA-Z0-9_]{2,16}$' then raise exception '닉네임 형식이 올바르지 않습니다.'; end if;
  if p_referral_code is not null then
    select id into referrer from public.profiles where referral_code = upper(p_referral_code) limit 1;
    if referrer = auth.uid() then referrer := null; end if;
  end if;
  insert into public.profiles(id, display_name, show_on_board, referred_by)
  values(auth.uid(), p_display_name, coalesce(p_show_on_board,false), referrer)
  on conflict(id) do update set display_name=excluded.display_name, show_on_board=excluded.show_on_board;
end; $$;

alter table public.profiles enable row level security;
alter table public.admins enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_clicks enable row level security;

drop policy if exists "profile owner reads own" on public.profiles;
create policy "profile owner reads own" on public.profiles for select to authenticated using (id = auth.uid() or (show_on_board = true and public.is_my_admin()));
drop policy if exists "admins read all profiles" on public.profiles;
create policy "admins read all profiles" on public.profiles for select to authenticated using (public.is_my_admin());
drop policy if exists "admins manage admins" on public.admins;
create policy "admins manage admins" on public.admins for select to authenticated using (user_id = auth.uid());
drop policy if exists "public read eligible published campaigns" on public.campaigns;
create policy "public read eligible published campaigns" on public.campaigns for select to authenticated using (status='published' and minor_approved=true);
drop policy if exists "admins read all campaigns" on public.campaigns;
create policy "admins read all campaigns" on public.campaigns for select to authenticated using (public.is_my_admin());
drop policy if exists "admins insert campaigns" on public.campaigns;
create policy "admins insert campaigns" on public.campaigns for insert to authenticated with check (public.is_my_admin());
drop policy if exists "admins update campaigns" on public.campaigns;
create policy "admins update campaigns" on public.campaigns for update to authenticated using (public.is_my_admin()) with check (public.is_my_admin());
drop policy if exists "admins delete campaigns" on public.campaigns;
create policy "admins delete campaigns" on public.campaigns for delete to authenticated using (public.is_my_admin());
drop policy if exists "authenticated users record own clicks" on public.campaign_clicks;
create policy "authenticated users record own clicks" on public.campaign_clicks for insert to authenticated with check (user_id=auth.uid() and exists(select 1 from public.campaigns c where c.id=campaign_id and c.status='published' and c.minor_approved=true));
drop policy if exists "admins read click reports" on public.campaign_clicks;
create policy "admins read click reports" on public.campaign_clicks for select to authenticated using (public.is_my_admin());

revoke all on public.profiles from anon, public;
revoke all on public.admins from anon, public;
revoke all on public.campaigns from anon, public;
revoke all on public.campaign_clicks from anon, public;
grant select on public.profiles to authenticated;
grant select on public.admins to authenticated;
grant select, insert, update, delete on public.campaigns to authenticated;
grant select, insert on public.campaign_clicks to authenticated;
grant execute on function public.is_my_admin() to authenticated;
grant execute on function public.save_my_profile(text,boolean,text) to authenticated;

-- 운영자 지정 방법: 먼저 웹사이트에서 익명 세션을 만든 뒤 브라우저 개발자 도구에서 auth user id를 확인하거나,
-- Supabase Dashboard > Authentication > Users 에서 해당 익명 사용자의 UUID를 복사해 아래 SQL에 넣고 실행합니다.
-- insert into public.admins(user_id) values ('여기에-본인-UUID');
