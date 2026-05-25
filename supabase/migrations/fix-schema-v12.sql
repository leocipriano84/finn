-- V12: last_digits e opening_balance em credit_cards
ALTER TABLE credit_cards
  ADD COLUMN IF NOT EXISTS last_digits text,
  ADD COLUMN IF NOT EXISTS opening_balance numeric(12,2) DEFAULT 0;
