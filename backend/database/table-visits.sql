BEGIN;

CREATE TABLE IF NOT EXISTS table_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  table_id UUID NOT NULL
    REFERENCES restaurant_tables(id)
    ON DELETE RESTRICT,

  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'bill_requested', 'closed')),

  -- The backend will use a private visit token to authorize
  -- customer access. Only its hash is stored here.
  access_token_hash TEXT NOT NULL,

  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bill_requested_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

-- A table can have only one unfinished visit.
-- Demo visitors can share Table 1 while keeping separate visits.
CREATE UNIQUE INDEX IF NOT EXISTS idx_visit_table_token
  ON table_visits(table_id, access_token_hash);

-- Existing orders remain valid without a visit.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS visit_id UUID
    REFERENCES table_visits(id)
    ON DELETE RESTRICT;

-- Repeating the same submission must not create another round.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS submission_key UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_visit_submission
  ON orders(visit_id, submission_key)
  WHERE visit_id IS NOT NULL
    AND submission_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_visit_id
  ON orders(visit_id);

-- One combined final bill per visit.
CREATE TABLE IF NOT EXISTS visit_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  visit_id UUID NOT NULL UNIQUE
    REFERENCES table_visits(id)
    ON DELETE RESTRICT,

  bill_number VARCHAR(50) NOT NULL UNIQUE,

  food_subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  alcohol_subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,

  cgst_rate NUMERIC(5,2) NOT NULL,
  sgst_rate NUMERIC(5,2) NOT NULL,
  vat_rate NUMERIC(5,2) NOT NULL,

  cgst_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  sgst_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0,

  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Preserve the billed item details for PDF regeneration.
  items_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS visit_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  visit_id UUID NOT NULL UNIQUE
    REFERENCES table_visits(id)
    ON DELETE RESTRICT,

  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  recommend BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;