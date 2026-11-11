-- ХОЧУ. 6.0 — база для первого рабочего MVP.
-- Выполнить ОДИН раз в Supabase → SQL Editor → New query → Run.
-- Требуется пустой проект (не переиспользуйте таблицы с такими именами).

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Пользователь' check (char_length(display_name) between 1 and 80),
  city text not null default '' check (char_length(city) <= 100),
  about text not null default '' check (char_length(about) <= 700),
  created_at timestamptz not null default now()
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 4 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  category text not null check (char_length(category) between 2 and 80),
  city text not null check (char_length(city) between 2 and 100),
  budget numeric(12,2) not null check (budget > 0 and budget <= 1000000000),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  price numeric(12,2) not null check (price > 0 and price <= 1000000000),
  description text not null check (char_length(description) between 4 and 2000),
  created_at timestamptz not null default now(),
  unique (request_id, seller_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index requests_buyer_idx on public.requests(buyer_id);
create index requests_created_idx on public.requests(created_at desc);
create index offers_request_idx on public.offers(request_id);
create index offers_seller_idx on public.offers(seller_id);
create index messages_offer_created_idx on public.messages(offer_id, created_at);

alter table public.profiles enable row level security;
alter table public.requests enable row level security;
alter table public.offers enable row level security;
alter table public.messages enable row level security;

-- Нет доступа для анонимных посетителей к данным; только вошедшие пользователи.
revoke all on public.profiles, public.requests, public.offers, public.messages from anon;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.requests to authenticated;
grant select, insert on public.offers to authenticated;
grant select, insert on public.messages to authenticated;

create policy "profiles_read" on public.profiles for select to authenticated using (true);
create policy "profiles_insert_self" on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy "profiles_update_self" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "requests_read" on public.requests for select to authenticated using (true);
create policy "requests_insert_self" on public.requests for insert to authenticated
  with check (buyer_id = (select auth.uid()));
create policy "requests_update_self" on public.requests for update to authenticated
  using (buyer_id = (select auth.uid())) with check (buyer_id = (select auth.uid()));
create policy "requests_delete_self" on public.requests for delete to authenticated
  using (buyer_id = (select auth.uid()));

create policy "offers_participants_read" on public.offers for select to authenticated
  using (seller_id = (select auth.uid()) or exists (
    select 1 from public.requests r where r.id = request_id and r.buyer_id = (select auth.uid())
  ));
create policy "offers_seller_insert" on public.offers for insert to authenticated
  with check (seller_id = (select auth.uid()) and exists (
    select 1 from public.requests r where r.id = request_id
      and r.status = 'open' and r.buyer_id <> (select auth.uid())
  ));

create policy "messages_participants_read" on public.messages for select to authenticated
  using (exists (
    select 1 from public.offers o join public.requests r on r.id = o.request_id
    where o.id = offer_id and (o.seller_id = (select auth.uid()) or r.buyer_id = (select auth.uid()))
  ));
create policy "messages_participants_insert" on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and exists (
    select 1 from public.offers o join public.requests r on r.id = o.request_id
    where o.id = offer_id and (o.seller_id = (select auth.uid()) or r.buyer_id = (select auth.uid()))
  ));

-- Пользователи создают профиль при первой авторизации из клиентского приложения.
-- Политики RLS проверяют владельцев записей на стороне БД.
