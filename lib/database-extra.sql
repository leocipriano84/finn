-- ============================================
-- FINN — Tabelas adicionais
-- Cole no Supabase SQL Editor (após o database.sql principal)
-- ============================================

-- 1. Conexões bancárias (Open Finance / Pluggy)
create table if not exists bank_connections (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  item_id text not null,           -- ID do Pluggy
  institution_name text not null,  -- Nome do banco
  institution_logo text,           -- URL do logo
  status text default 'active' check (status in ('active', 'error', 'disconnected')),
  last_synced_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(user_id, item_id)
);

alter table bank_connections enable row level security;

create policy "Usuário gerencia próprias conexões"
  on bank_connections for all
  using (auth.uid() = user_id);

-- 2. Transações — adicionar campos Open Finance
alter table transactions
  add column if not exists external_id text unique,
  add column if not exists source text default 'manual' check (source in ('manual', 'open_finance')),
  add column if not exists bank_name text;

-- 3. Conquistas (achievements)
create table if not exists user_achievements (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  achievement_id text not null,
  unlocked_at timestamp with time zone default now(),
  unique(user_id, achievement_id)
);

alter table user_achievements enable row level security;

create policy "Usuário vê próprias conquistas"
  on user_achievements for select
  using (auth.uid() = user_id);

create policy "Sistema insere conquistas"
  on user_achievements for insert
  with check (true); -- inserção via service key no backend

-- 4. Perfil comportamental — adicionar campos ao profiles
alter table profiles
  add column if not exists personality_id text default 'impulsive',
  add column if not exists xp integer default 0,
  add column if not exists level integer default 1,
  add column if not exists streak integer default 0,
  add column if not exists last_active_date date,
  add column if not exists profile_evolutions integer default 0;

-- 5. Notificações push (para PWA)
create table if not exists push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamp with time zone default now()
);

alter table push_subscriptions enable row level security;

create policy "Usuário gerencia próprias subscriptions"
  on push_subscriptions for all
  using (auth.uid() = user_id);

-- 6. Planos e preços (registro interno)
create table if not exists subscription_plans (
  id text primary key,
  name text not null,
  price_monthly numeric(10,2),
  price_yearly numeric(10,2),
  stripe_price_monthly text,
  stripe_price_yearly text,
  features jsonb
);

insert into subscription_plans values
  ('free', 'Grátis', 0, 0, null, null,
   '{"transactions": 50, "goals": 3, "coach": false, "open_finance": false}'::jsonb),
  ('pro', 'Coach Pro', 19.00, 152.00, null, null,
   '{"transactions": -1, "goals": -1, "coach": true, "open_finance": true}'::jsonb)
on conflict (id) do nothing;

-- 7. View útil: resumo financeiro por usuário
create or replace view user_financial_summary as
select
  p.id as user_id,
  p.name,
  p.plan,
  p.score,
  p.personality_id,
  p.xp,
  p.level,
  p.streak,
  count(distinct bc.id) as bank_connections,
  count(distinct t.id) as total_transactions,
  coalesce(sum(case when t.type = 'income' and t.date >= date_trunc('month', current_date) then t.amount end), 0) as monthly_income,
  coalesce(sum(case when t.type = 'expense' and t.date >= date_trunc('month', current_date) then t.amount end), 0) as monthly_expenses,
  count(distinct ua.achievement_id) as achievements_count
from profiles p
left join bank_connections bc on bc.user_id = p.id and bc.status = 'active'
left join transactions t on t.user_id = p.id
left join user_achievements ua on ua.user_id = p.id
group by p.id, p.name, p.plan, p.score, p.personality_id, p.xp, p.level, p.streak;

-- Usuário vê apenas o próprio resumo
create policy "Usuário vê próprio resumo"
  on user_financial_summary for select
  using (auth.uid() = user_id);
