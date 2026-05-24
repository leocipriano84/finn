-- Fix 1: transactions — adiciona coluna frequency
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS frequency text DEFAULT 'once';

-- Fix 2: categories — garante id com default e adiciona colunas ausentes
ALTER TABLE categories ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE categories ADD COLUMN IF NOT EXISTS icon text DEFAULT '📦';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES categories(id) ON DELETE SET NULL;

-- Fix 3: goals — adiciona coluna icon
ALTER TABLE goals ADD COLUMN IF NOT EXISTS icon text DEFAULT '🎯';

-- Fix 4: budgets — adiciona coluna amount
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS amount numeric(12,2) DEFAULT 0;

-- Recarregar schema cache (aguardar ~60s após executar)
NOTIFY pgrst, 'reload schema';
