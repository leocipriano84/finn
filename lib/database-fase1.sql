-- ============================================================
-- FINN — FASE 1: Migração para schema completo
-- Execute no Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- =============================================
-- ACCOUNTS — Contas bancárias
-- =============================================
create table if not exists accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  bank_name text,
  bank_code text,
  type text default 'checking' check (type in ('checking','savings','cash','investment','other')),
  initial_balance numeric(12,2) default 0,
  current_balance numeric(12,2) default 0,
  overdraft_limit numeric(12,2) default 0,
  color text default '#00F5A0',
  icon text,
  show_in_summary boolean default true,
  ignore_in_totals boolean default false,
  ignore_in_balance boolean default false,
  is_default boolean default false,
  archived boolean default false,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table accounts enable row level security;
drop policy if exists "accounts_user" on accounts;
create policy "accounts_user" on accounts for all using (auth.uid() = user_id);

-- =============================================
-- CREDIT_CARDS — Cartões de crédito
-- =============================================
create table if not exists credit_cards (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  bank_name text,
  bank_code text,
  flag text check (flag in ('visa','mastercard','elo','amex','hipercard','other')) default 'other',
  limit_amount numeric(12,2) not null default 0,
  closing_day integer not null check (closing_day between 1 and 31),
  due_day integer not null check (due_day between 1 and 31),
  dynamic_closing boolean default false,
  due_on_business_day boolean default false,
  account_id uuid references accounts(id),
  color text default '#00C9FF',
  is_main boolean default false,
  archived boolean default false,
  sort_order integer default 0,
  created_at timestamptz default now()
);
alter table credit_cards enable row level security;
drop policy if exists "cards_user" on credit_cards;
create policy "cards_user" on credit_cards for all using (auth.uid() = user_id);

-- =============================================
-- CATEGORIES — Categorias e subcategorias
-- =============================================
create table if not exists categories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  type text check (type in ('income','expense','both')) not null,
  icon text not null default '📦',
  color text not null default '#6b7280',
  is_default boolean default false,
  parent_id uuid references categories(id),
  sort_order integer default 0,
  archived boolean default false,
  created_at timestamptz default now()
);
alter table categories enable row level security;
drop policy if exists "categories_user" on categories;
create policy "categories_user" on categories for all using (auth.uid() = user_id);

-- =============================================
-- TAGS — Tags personalizadas
-- =============================================
create table if not exists tags (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  color text default '#6b7280',
  created_at timestamptz default now()
);
alter table tags enable row level security;
drop policy if exists "tags_user" on tags;
create policy "tags_user" on tags for all using (auth.uid() = user_id);

-- =============================================
-- CARD_INVOICES — Faturas de cartão
-- =============================================
create table if not exists card_invoices (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  credit_card_id uuid references credit_cards(id) on delete cascade not null,
  reference_month text not null,
  closing_date date not null,
  due_date date not null,
  total_amount numeric(12,2) default 0,
  paid_amount numeric(12,2) default 0,
  status text default 'open' check (status in ('open','closed','paid')),
  payment_account_id uuid references accounts(id),
  payment_date date,
  created_at timestamptz default now()
);
alter table card_invoices enable row level security;
drop policy if exists "invoices_user" on card_invoices;
create policy "invoices_user" on card_invoices for all using (auth.uid() = user_id);

-- =============================================
-- BUDGETS — Orçamentos por categoria (criar)
-- =============================================
create table if not exists budgets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  amount numeric(12,2) not null,
  category_id uuid references categories(id),
  month text,
  period text default 'monthly' check (period in ('monthly','yearly','custom')),
  alert_at_percent integer default 80,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table budgets enable row level security;
drop policy if exists "budgets_user" on budgets;
create policy "budgets_user" on budgets for all using (auth.uid() = user_id);

-- =============================================
-- USER_PREFERENCES — Configurações do usuário
-- =============================================
create table if not exists user_preferences (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null unique,
  summary_widgets jsonb default '["overview","expense_chart","accounts","last_expenses","expense_by_category"]',
  always_show_overdue_first boolean default true,
  show_pending_first boolean default false,
  order_future_by_due_date boolean default true,
  zebra_list boolean default false,
  highlight_description boolean default false,
  uppercase_description boolean default false,
  layout_scale integer default 100,
  alert_budget_on_expense boolean default true,
  alert_insufficient_balance boolean default true,
  show_balance_on_save boolean default true,
  accumulate_balance_future boolean default true,
  pin_enabled boolean default false,
  pin_code text,
  pin_timeout_minutes integer default 15,
  biometric_enabled boolean default false,
  blur_on_switch boolean default true,
  default_account_id uuid references accounts(id),
  default_card_id uuid references credit_cards(id),
  currency text default 'BRL',
  date_format text default 'DD/MM/YYYY',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table user_preferences enable row level security;
drop policy if exists "prefs_user" on user_preferences;
create policy "prefs_user" on user_preferences for all using (auth.uid() = user_id);

-- =============================================
-- TRANSACTIONS — Atualizar colunas existentes
-- =============================================

-- Atualizar check constraint do tipo (de 'income','expense' para incluir 'expense_card','transfer')
do $$
begin
  -- Remove constraint antiga se existir
  if exists (
    select 1 from information_schema.table_constraints
    where table_name = 'transactions'
      and constraint_type = 'CHECK'
      and constraint_name like '%type%'
  ) then
    alter table transactions drop constraint if exists transactions_type_check;
  end if;
  -- Adiciona constraint nova
  alter table transactions add constraint transactions_type_check
    check (type in ('expense','expense_card','income','transfer'));
exception when others then
  null;
end $$;

-- Adicionar colunas novas (seguro com IF NOT EXISTS)
alter table transactions
  add column if not exists account_id uuid references accounts(id),
  add column if not exists credit_card_id uuid references credit_cards(id),
  add column if not exists transfer_account_id uuid references accounts(id),
  add column if not exists category_id uuid references categories(id),
  add column if not exists subcategory_id uuid references categories(id),
  add column if not exists tag_ids uuid[],
  add column if not exists status text default 'confirmed'
    check (status in ('confirmed','pending')),
  add column if not exists recurrence text default 'none'
    check (recurrence in ('none','fixed_monthly','fixed_weekly','fixed_yearly','installment')),
  add column if not exists installment_current integer default 1,
  add column if not exists installment_total integer default 1,
  add column if not exists recurrence_group_id uuid,
  add column if not exists due_date date,
  add column if not exists effective_date date,
  add column if not exists competence_date date,
  add column if not exists attachment_url text,
  add column if not exists notes text,
  add column if not exists ignore_in_charts boolean default false,
  add column if not exists ignore_in_budgets boolean default false,
  add column if not exists ignore_in_totals boolean default false,
  add column if not exists ignore_in_monthly_savings boolean default false,
  add column if not exists card_invoice_month text;

-- =============================================
-- ÍNDICES de performance
-- =============================================
create index if not exists idx_transactions_user_date on transactions(user_id, due_date desc);
create index if not exists idx_transactions_account on transactions(account_id);
create index if not exists idx_transactions_card on transactions(credit_card_id);
create index if not exists idx_transactions_category on transactions(category_id);
create index if not exists idx_transactions_status on transactions(status);
create index if not exists idx_transactions_recurrence_group on transactions(recurrence_group_id);
create index if not exists idx_accounts_user on accounts(user_id);
create index if not exists idx_categories_user on categories(user_id, type);
create index if not exists idx_categories_parent on categories(parent_id);
create index if not exists idx_credit_cards_user on credit_cards(user_id);
create index if not exists idx_card_invoices_card on card_invoices(credit_card_id, reference_month);
create index if not exists idx_budgets_user_month on budgets(user_id, month);
