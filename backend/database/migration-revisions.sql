BEGIN;

-- 1. Support bill revisions and invalidation upon reopening
DO $$
BEGIN
  -- Drop the legacy strict unique constraint on visit_id so multiple revisions can be kept
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'visit_bills_visit_id_key'
      AND conrelid = 'visit_bills'::regclass
  ) THEN
    ALTER TABLE visit_bills DROP CONSTRAINT visit_bills_visit_id_key;
  END IF;
END $$;

ALTER TABLE visit_bills
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'visit_bills_status_check'
      AND conrelid = 'visit_bills'::regclass
  ) THEN
    ALTER TABLE visit_bills
      ADD CONSTRAINT visit_bills_status_check
      CHECK (status IN ('active', 'superseded', 'cancelled'));
  END IF;
END $$;

-- Exactly one active bill per visit
CREATE UNIQUE INDEX IF NOT EXISTS idx_visit_bills_active
  ON visit_bills(visit_id)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_visit_bills_visit_id
  ON visit_bills(visit_id);

-- 2. Preserve item names, variant labels and tax treatment at order time in order_items
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS item_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS variant_label VARCHAR(50),
  ADD COLUMN IF NOT EXISTS is_alcoholic BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill existing order_items from menu_items & variants if null
UPDATE order_items oi
SET item_name = mi.name,
    is_alcoholic = mi.is_alcoholic
FROM menu_items mi
WHERE oi.menu_item_id = mi.id
  AND oi.item_name IS NULL;

UPDATE order_items oi
SET variant_label = mv.label
FROM menu_item_variants mv
WHERE oi.variant_id = mv.id
  AND oi.variant_label IS NULL;

COMMIT;
