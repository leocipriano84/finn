-- Finn Financial App — Complete Database Schema
-- Run in Supabase SQL editor

-- ==========================================
-- PROFILES (extend existing table)
-- ==========================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS referral_credits INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS streak_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_active_date DATE,
  ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_income NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS financial_month_start INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS personality_id TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_done BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- ==========================================
-- TRANSACTIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  frequency TEXT DEFAULT 'once' CHECK (frequency IN ('once', 'daily', 'weekly', 'monthly', 'yearly')),
  recurring_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS transactions_user_type ON transactions(user_id, type);
CREATE INDEX IF NOT EXISTS transactions_user_category ON transactions(user_id, category);

-- ==========================================
-- GOALS
-- ==========================================
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT DEFAULT 'savings',
  icon TEXT DEFAULT '⭐',
  target_amount NUMERIC(12,2) NOT NULL,
  current_amount NUMERIC(12,2) DEFAULT 0,
  deadline DATE,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS goals_user_id ON goals(user_id);

-- ==========================================
-- BUDGETS
-- ==========================================
CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  limit_amount NUMERIC(12,2) NOT NULL,
  month_year TEXT NOT NULL, -- format: YYYY-MM
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, category, month_year)
);

CREATE INDEX IF NOT EXISTS budgets_user_month ON budgets(user_id, month_year);

-- ==========================================
-- USER ACHIEVEMENTS
-- ==========================================
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  points INTEGER DEFAULT 0,
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS achievements_user_id ON user_achievements(user_id);

-- ==========================================
-- RECURRING TRANSACTIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS recurring_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount NUMERIC(12,2) NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  start_date DATE NOT NULL,
  end_date DATE,
  last_generated DATE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recurring_user_id ON recurring_transactions(user_id);

-- ==========================================
-- BILLS (upcoming bills tracker)
-- ==========================================
CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(12,2),
  due_day INTEGER CHECK (due_day BETWEEN 1 AND 31),
  category TEXT,
  paid BOOLEAN DEFAULT FALSE,
  paid_at TIMESTAMPTZ,
  month_year TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bills_user_id ON bills(user_id);

-- ==========================================
-- SUPPORT TICKETS
-- ==========================================
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  admin_reply TEXT,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS tickets_status ON support_tickets(status);

-- ==========================================
-- REFERRAL CODES
-- ==========================================
CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS referral_codes_user ON referral_codes(user_id);
CREATE INDEX IF NOT EXISTS referral_codes_code ON referral_codes(code);

-- ==========================================
-- REFERRALS
-- ==========================================
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  referred_email TEXT,
  code TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'converted', 'cancelled')),
  rewarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS referrals_referred ON referrals(referred_id);

-- ==========================================
-- REFERRAL REWARDS
-- ==========================================
CREATE TABLE IF NOT EXISTS referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credits INTEGER NOT NULL,
  type TEXT DEFAULT 'conversion',
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rewards_referrer ON referral_rewards(referrer_id);

-- ==========================================
-- PUSH SUBSCRIPTIONS (PWA notifications)
-- ==========================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS push_user_id ON push_subscriptions(user_id);

-- ==========================================
-- ROW LEVEL SECURITY
-- ==========================================
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies: users can only see/edit their own data
CREATE POLICY IF NOT EXISTS "transactions_own" ON transactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "goals_own" ON goals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "budgets_own" ON budgets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "achievements_own" ON user_achievements FOR ALL USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "recurring_own" ON recurring_transactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "bills_own" ON bills FOR ALL USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "tickets_own" ON support_tickets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "ref_codes_own" ON referral_codes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "referrals_own" ON referrals FOR ALL USING (auth.uid() = referrer_id OR auth.uid() = referred_id);
CREATE POLICY IF NOT EXISTS "rewards_own" ON referral_rewards FOR ALL USING (auth.uid() = referrer_id);
CREATE POLICY IF NOT EXISTS "push_own" ON push_subscriptions FOR ALL USING (auth.uid() = user_id);
