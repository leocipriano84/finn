-- ============================================
-- FINN: FIX SCHEMA MASTER V5
-- Executar no Supabase Dashboard > SQL Editor
-- ============================================

-- transactions: colunas ausentes + coluna due_date alinhada com código
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS frequency text DEFAULT 'once';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category_id uuid;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS account_id uuid;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS credit_card_id uuid;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS recurrence text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS recurrence_group_id uuid;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS installment_current integer;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS installment_total integer;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS ignore_in_charts boolean DEFAULT false;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS ignore_in_budgets boolean DEFAULT false;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS ignore_in_totals boolean DEFAULT false;

-- Copiar date → due_date para transações existentes que não têm due_date
UPDATE transactions SET due_date = date WHERE due_date IS NULL AND date IS NOT NULL;

-- status default deve ser 'pending'
ALTER TABLE transactions ALTER COLUMN status SET DEFAULT 'pending';

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- categories: id com default e limpar L dos ícones
ALTER TABLE categories ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE categories ADD COLUMN IF NOT EXISTS icon text DEFAULT '📦';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id uuid;
UPDATE categories SET icon = REGEXP_REPLACE(icon, '^L', '') WHERE icon LIKE 'L%';

-- goals: coluna icon
ALTER TABLE goals ADD COLUMN IF NOT EXISTS icon text DEFAULT '🎯';
ALTER TABLE goals ADD COLUMN IF NOT EXISTS color text DEFAULT '#00F5A0';
ALTER TABLE goals ADD COLUMN IF NOT EXISTS completed boolean DEFAULT false;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS current_amount numeric(12,2) DEFAULT 0;

-- budgets: colunas ausentes
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS amount numeric(12,2) DEFAULT 0;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS month text;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS category_id uuid;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS period text DEFAULT 'monthly';
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS alert_at_percent integer DEFAULT 80;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- accounts: cheque especial
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS overdraft_limit numeric(12,2) DEFAULT 0;

-- profiles: avatar
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_emoji text;

-- Bucket para avatars (executar em ambiente Supabase com storage habilitado)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Recarregar schema cache
NOTIFY pgrst, 'reload schema';
