-- ============================================
-- FINN — Setup completo do banco de dados
-- Cole e execute no Supabase SQL Editor
-- ============================================

-- 1. Tabela de lista de espera
create table if not exists waitlist (
  id uuid default gen_random_uuid() primary key,
  email text not null unique,
  source text default 'landing',
  confirmed boolean default false,
  created_at timestamp with time zone default now()
);

-- Índice para busca rápida
create index if not exists idx_waitlist_email on waitlist(email);
create index if not exists idx_waitlist_created on waitlist(created_at desc);

-- Row Level Security
alter table waitlist enable row level security;

-- Só permite INSERT público (nunca SELECT pelo frontend)
create policy "Inserção pública permitida"
  on waitlist for insert
  with check (true);

-- ============================================
-- 2. Tabela de usuários (para o app depois)
-- ============================================
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  avatar_url text,
  plan text default 'free' check (plan in ('free', 'pro')),
  score integer default 0 check (score between 0 and 100),
  stripe_customer_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table profiles enable row level security;

-- Usuário só vê e edita o próprio perfil
create policy "Usuário vê próprio perfil"
  on profiles for select
  using (auth.uid() = id);

create policy "Usuário edita próprio perfil"
  on profiles for update
  using (auth.uid() = id);

-- Criar perfil automaticamente ao cadastrar
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (new.id, new.raw_user_meta_data->>'name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- 3. Tabela de transações (para o app depois)
-- ============================================
create table if not exists transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  amount numeric(10,2) not null,
  type text check (type in ('income', 'expense')) not null,
  category text not null,
  description text,
  date date not null default current_date,
  created_at timestamp with time zone default now()
);

create index if not exists idx_transactions_user on transactions(user_id);
create index if not exists idx_transactions_date on transactions(date desc);

alter table transactions enable row level security;

create policy "Usuário vê próprias transações"
  on transactions for select
  using (auth.uid() = user_id);

create policy "Usuário cria próprias transações"
  on transactions for insert
  with check (auth.uid() = user_id);

create policy "Usuário edita próprias transações"
  on transactions for update
  using (auth.uid() = user_id);

create policy "Usuário deleta próprias transações"
  on transactions for delete
  using (auth.uid() = user_id);

-- ============================================
-- 4. Tabela de metas
-- ============================================
create table if not exists goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  target_amount numeric(10,2) not null,
  current_amount numeric(10,2) default 0,
  deadline date,
  completed boolean default false,
  created_at timestamp with time zone default now()
);

alter table goals enable row level security;

create policy "Usuário gerencia próprias metas"
  on goals for all
  using (auth.uid() = user_id);

-- ============================================
-- 5. Tabela de mensagens do Coach IA
-- ============================================
create table if not exists coach_messages (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  role text check (role in ('user', 'assistant')) not null,
  content text not null,
  created_at timestamp with time zone default now()
);

create index if not exists idx_coach_user on coach_messages(user_id);
create index if not exists idx_coach_created on coach_messages(created_at desc);

alter table coach_messages enable row level security;

create policy "Usuário vê próprias mensagens do coach"
  on coach_messages for select
  using (auth.uid() = user_id);

-- ============================================
-- 6. Query úteis para o painel
-- ============================================

-- Ver todos os emails da waitlist
-- select email, source, created_at from waitlist order by created_at desc;

-- Contar total na waitlist
-- select count(*) from waitlist;

-- Exportar waitlist como CSV
-- No painel: Table Editor → waitlist → botão "Export to CSV"
