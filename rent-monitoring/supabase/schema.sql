-- Схема базы данных «Мониторинг стоимости аренды» (PostgreSQL / Supabase).
-- Выполните скрипт в SQL Editor проекта Supabase, затем укажите
-- VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в файле .env.

create table if not exists rent_requests (
  id                 text primary key,
  number             text not null unique,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  region             text not null,
  settlement         text not null,
  property_type      text not null,
  address            text not null,
  area               numeric(12,2) not null check (area > 0),
  monthly_cost       numeric(16,2) not null check (monthly_cost > 0),
  supplier           text not null,
  notes              text not null default '',
  price_per_m2       numeric(14,2) not null,
  benchmark          numeric(14,2),
  benchmark_count    integer not null default 0,
  benchmark_level    text,
  deviation          numeric(8,2),
  compliance         text not null check (compliance in ('over','within','nodata')),
  status             text not null,
  remarks            jsonb not null default '[]'::jsonb,
  added_to_price_base boolean not null default false,
  is_demo            boolean not null default false
);

create table if not exists price_records (
  id            text primary key,
  region        text not null,
  settlement    text not null,
  property_type text not null,
  area          numeric(12,2) not null check (area > 0),
  monthly_cost  numeric(16,2) not null check (monthly_cost > 0),
  price_per_m2  numeric(14,2) not null,
  purchase_date date not null,
  source        text not null,
  request_id    text references rent_requests(id) on delete set null,
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists price_records_lookup on price_records (region, settlement, property_type, purchase_date);

create table if not exists market_offers (
  id            text primary key,
  region        text not null,
  settlement    text not null,
  address       text not null,
  property_type text not null,
  area          numeric(12,2) not null check (area > 0),
  monthly_cost  numeric(16,2) not null check (monthly_cost > 0),
  price_per_m2  numeric(14,2) not null,
  listing_date  date not null,
  source        text not null,
  url           text not null default '',
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists app_settings (
  id   text primary key,
  data jsonb not null
);

-- Демонстрационный режим: открытый доступ для anon-ключа.
-- Для промышленной эксплуатации замените политики на ролевые (Supabase Auth).
alter table rent_requests  enable row level security;
alter table price_records  enable row level security;
alter table market_offers  enable row level security;
alter table app_settings   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['rent_requests','price_records','market_offers','app_settings'] loop
    execute format('drop policy if exists demo_all on %I', t);
    execute format('create policy demo_all on %I for all using (true) with check (true)', t);
  end loop;
end $$;
