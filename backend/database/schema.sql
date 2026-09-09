CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(150) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'manager',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT managers_role_check CHECK (role IN ('manager', 'owner', 'admin'))
);

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number INTEGER NOT NULL UNIQUE,
  capacity INTEGER NOT NULL DEFAULT 4,
  status VARCHAR(20) NOT NULL DEFAULT 'available',
  location VARCHAR(100),
  qr_code_text VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT restaurant_tables_status_check CHECK (status IN ('available', 'occupied', 'reserved', 'out_of_service')),
  CONSTRAINT restaurant_tables_capacity_check CHECK (capacity > 0)
);

CREATE TABLE IF NOT EXISTS menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  menu_type VARCHAR(20) NOT NULL DEFAULT 'food',
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT menu_categories_menu_type_check CHECK (menu_type IN ('food', 'bar'))
);

-- Minimal field needed to group Food categories into Vegetarian Items /
-- Non-Vegetarian Items (Bar categories simply leave this NULL). No new
-- constraint, table, or slug system - just this one nullable column, safe
-- to re-run on a database created before it existed.
ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS food_group VARCHAR(20);

CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES menu_categories(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  image_url VARCHAR(500),
  is_veg BOOLEAN NOT NULL DEFAULT TRUE,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  is_alcoholic BOOLEAN NOT NULL DEFAULT FALSE,
  preparation_time_minutes INTEGER NOT NULL DEFAULT 15,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT menu_items_price_check CHECK (price >= 0)
);

-- Safe to re-run against a database created before this column existed.
-- Not every Bar item is alcoholic (Cold Drinks & Others, Solkadhi, etc.),
-- so this can't be inferred from menu_type alone - it has to be its own
-- explicit flag, set correctly per item in seed.sql / by managers.
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_alcoholic BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS menu_item_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE ON UPDATE CASCADE,
  label VARCHAR(50) NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT menu_item_variants_price_check CHECK (price >= 0),
  UNIQUE (menu_item_id, label)
);

CREATE TABLE IF NOT EXISTS todays_specials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL UNIQUE REFERENCES menu_items(id) ON DELETE CASCADE ON UPDATE CASCADE,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  is_featured BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL ON UPDATE CASCADE,
  manager_id UUID REFERENCES managers(id) ON DELETE SET NULL ON UPDATE CASCADE,
  order_number VARCHAR(50) NOT NULL UNIQUE,
  customer_name VARCHAR(150),
  status VARCHAR(25) NOT NULL DEFAULT 'pending',
  payment_status VARCHAR(25) NOT NULL DEFAULT 'unpaid',
  payment_method VARCHAR(30),
  paid_at TIMESTAMPTZ,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT orders_status_check CHECK (status IN ('pending', 'accepted', 'preparing', 'ready', 'completed', 'cancelled')),
  CONSTRAINT orders_payment_status_check CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
  CONSTRAINT orders_payment_method_check CHECK (payment_method IS NULL OR payment_method IN ('cash', 'card', 'upi', 'split'))
);

-- Safe to re-run against a database created before these columns existed.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_method_check') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check CHECK (payment_method IS NULL OR payment_method IN ('cash', 'card', 'upi', 'split'));
  END IF;
END $$;

-- Per-category tax breakdown (CGST/SGST on non-alcoholic, VAT on alcoholic).
-- tax_amount stays as the combined total (cgst_amount + sgst_amount +
-- vat_amount) and subtotal stays as the combined total (food_subtotal +
-- alcohol_subtotal), so every existing reader of those two columns keeps
-- working unchanged. Safe to re-run against a database created before these
-- columns existed.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS food_subtotal NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS alcohol_subtotal NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE ON UPDATE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  variant_id UUID REFERENCES menu_item_variants(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT order_items_quantity_check CHECK (quantity > 0)
);

-- Safe to re-run against an older database whose order_items table predates
-- variants (menu_item_variants/variant_id were added later). CREATE TABLE IF
-- NOT EXISTS above is a no-op on such a database, so the column has to be
-- added explicitly here, or the idx_order_items_variant_id index further
-- down fails with "column variant_id does not exist".
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES menu_item_variants(id) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE ON UPDATE CASCADE,
  bill_number VARCHAR(50) NOT NULL UNIQUE,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(30),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bills_payment_method_check CHECK (payment_method IS NULL OR payment_method IN ('cash', 'card', 'upi', 'split'))
);
-- Generating an invoice PDF is not the same thing as paying it - a bill row
-- used to default to payment_method='cash' the instant it was created, which
-- is what let a bill look "paid" while orders.payment_status stayed
-- 'unpaid'. It's nullable now; payOrder() below fills it in only when a
-- payment is actually completed.
ALTER TABLE bills ALTER COLUMN payment_method DROP DEFAULT;

-- Same per-category breakdown as orders (see above), copied onto the bill
-- at generation time so the PDF invoice always matches what was actually
-- charged, even if tax rules changed later. Safe to re-run.
ALTER TABLE bills ADD COLUMN IF NOT EXISTS food_subtotal NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS alcohol_subtotal NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS split_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE ON UPDATE CASCADE,
  people_count INTEGER NOT NULL DEFAULT 1,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT split_bills_people_count_check CHECK (people_count > 0)
);

CREATE TABLE IF NOT EXISTS split_bill_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  split_bill_id UUID NOT NULL REFERENCES split_bills(id) ON DELETE CASCADE ON UPDATE CASCADE,
  person_name VARCHAR(150) NOT NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_paid BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT split_bill_shares_amount_check CHECK (amount >= 0)
);

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE ON UPDATE CASCADE,
  rating SMALLINT NOT NULL,
  comment TEXT,
  recommend BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT feedback_rating_check CHECK (rating BETWEEN 1 AND 5)
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID REFERENCES managers(id) ON DELETE CASCADE ON UPDATE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE ON UPDATE CASCADE,
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(30) NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notifications_type_check CHECK (type IN ('info', 'order', 'payment', 'stock', 'system'))
);

CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES managers(id) ON DELETE CASCADE ON UPDATE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE ON UPDATE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(manager_id, menu_item_id)
);

CREATE TABLE IF NOT EXISTS restaurant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The Food menu used to be a flat list of categories (Veg Starters, Veg
-- Main Course, Veg Chinese, Veg Thali, plus Rice & Khichadi and Veg Biryani
-- as two separate categories). It's now grouped into Vegetarian Items /
-- Non-Vegetarian Items.
--
-- This has to be safe on THREE different starting states, because a
-- database may have already been partly migrated by an earlier version of
-- this exact script:
--   1. Fresh / never migrated - old slug exists, no row has the new name yet.
--   2. Already fully migrated - old slug is gone, nothing to do.
--   3. Partially/differently migrated - old slug still exists AND a
--      different row already has the target name (e.g. from an earlier
--      attempt that renamed it under a different slug). Blindly renaming
--      in this case would violate the UNIQUE(name) constraint - which is
--      exactly the "duplicate key value violates unique constraint
--      menu_categories_name_key" failure this replaces. Instead, merge: move
--      every dish from the old-slug row onto the row that already has the
--      right name, then remove the now-empty old row.
-- Only name, food_group, and display_order ever change - ids are never
-- touched, so nothing that references a category by id is affected, and
-- every branch is a no-op once already applied.
DO $$
DECLARE
  m RECORD;
  old_id UUID;
  existing_id UUID;
BEGIN
  FOR m IN
    SELECT * FROM (VALUES
      ('veg-starters', 'Starters', 3),
      ('veg-main-course', 'Main Course', 4),
      ('veg-chinese', 'Chinese', 5),
      ('rice-khichadi', 'Rice & Biryani', 6),
      ('veg-thali', 'Thali', 8)
    ) AS t(old_slug, new_name, new_order)
  LOOP
    SELECT id INTO old_id FROM menu_categories WHERE slug = m.old_slug;
    IF old_id IS NULL THEN
      CONTINUE; -- already migrated (slug no longer exists), or a fresh install seed.sql will insert directly
    END IF;

    SELECT id INTO existing_id FROM menu_categories WHERE name = m.new_name AND id <> old_id;

    IF existing_id IS NOT NULL THEN
      UPDATE menu_items SET category_id = existing_id WHERE category_id = old_id;
      UPDATE menu_categories SET food_group = 'vegetarian', display_order = m.new_order WHERE id = existing_id;
      DELETE FROM menu_categories WHERE id = old_id;
    ELSE
      UPDATE menu_categories SET name = m.new_name, display_order = m.new_order WHERE id = old_id;
    END IF;
  END LOOP;
END $$;

UPDATE menu_categories SET display_order = 7 WHERE slug = 'roti-breads';
UPDATE menu_categories SET display_order = 1 WHERE slug = 'soup';
UPDATE menu_categories SET display_order = 2 WHERE slug = 'snacks';
UPDATE menu_categories SET display_order = 9 WHERE slug = 'egg-items';
UPDATE menu_categories SET display_order = 10 WHERE slug = 'chicken-starters-tandoori';
UPDATE menu_categories SET display_order = 11 WHERE slug = 'chicken-main-course-biryani';
UPDATE menu_categories SET display_order = 12 WHERE slug = 'chicken-thalis';
UPDATE menu_categories SET display_order = 13 WHERE slug = 'mutton-liver-items';
UPDATE menu_categories SET display_order = 14 WHERE slug = 'fish-seafood';
UPDATE menu_categories SET display_order = 15 WHERE slug = 'seafood-thalis';

-- "Veg Biryani" merges into whichever row is now canonically named
-- "Rice & Biryani" - found by name (not an assumed slug), since the block
-- above may have reached that name via either the rename or the merge
-- branch. ON DELETE RESTRICT on menu_items.category_id means the DELETE
-- would fail on its own if any dish still pointed at "Veg Biryani" - that's
-- the safety net guaranteeing this never silently loses a dish.
DO $$
DECLARE
  biryani_id UUID;
  target_id UUID;
BEGIN
  SELECT id INTO biryani_id FROM menu_categories WHERE slug = 'veg-biryani';
  IF biryani_id IS NOT NULL THEN
    SELECT id INTO target_id FROM menu_categories WHERE name = 'Rice & Biryani' LIMIT 1;
    IF target_id IS NOT NULL THEN
      UPDATE menu_items SET category_id = target_id WHERE category_id = biryani_id;
      DELETE FROM menu_categories WHERE id = biryani_id;
    END IF;
  END IF;
END $$;

-- Backfill the Vegetarian / Non-Vegetarian grouping AND the canonical
-- display_order by the category's final display name rather than an
-- assumed slug, since the slug a given database ended up with depends on
-- which branch above it took (a category already renamed under a
-- different slug by an earlier migration is matched here by name, so its
-- position in the menu still ends up correct even though the slug-keyed
-- rename block above skipped it). Bar categories are left untouched - they
-- keep food_group NULL, since Bar has no such split.
UPDATE menu_categories SET food_group = 'vegetarian'
  WHERE menu_type = 'food' AND name IN ('Soup', 'Snacks', 'Starters', 'Main Course', 'Chinese', 'Rice & Biryani', 'Roti & Breads', 'Thali')
  AND food_group IS DISTINCT FROM 'vegetarian';
UPDATE menu_categories SET food_group = 'non-vegetarian'
  WHERE menu_type = 'food' AND name IN ('Egg Items', 'Chicken Starters & Tandoori', 'Chicken Main Course & Biryani', 'Chicken Thalis', 'Mutton & Liver Items', 'Fish & Seafood', 'Seafood Thalis')
  AND food_group IS DISTINCT FROM 'non-vegetarian';

UPDATE menu_categories SET display_order = 1 WHERE menu_type = 'food' AND name = 'Soup' AND display_order <> 1;
UPDATE menu_categories SET display_order = 2 WHERE menu_type = 'food' AND name = 'Snacks' AND display_order <> 2;
UPDATE menu_categories SET display_order = 3 WHERE menu_type = 'food' AND name = 'Starters' AND display_order <> 3;
UPDATE menu_categories SET display_order = 4 WHERE menu_type = 'food' AND name = 'Main Course' AND display_order <> 4;
UPDATE menu_categories SET display_order = 5 WHERE menu_type = 'food' AND name = 'Chinese' AND display_order <> 5;
UPDATE menu_categories SET display_order = 6 WHERE menu_type = 'food' AND name = 'Rice & Biryani' AND display_order <> 6;
UPDATE menu_categories SET display_order = 7 WHERE menu_type = 'food' AND name = 'Roti & Breads' AND display_order <> 7;
UPDATE menu_categories SET display_order = 8 WHERE menu_type = 'food' AND name = 'Thali' AND display_order <> 8;

-- menu_items had no uniqueness guard, so seed.sql's `ON CONFLICT DO NOTHING`
-- on it never actually matched a constraint and every re-run of `npm run
-- db:init` inserted a fresh copy of the whole menu. Fixed going forward by
-- the UNIQUE constraint below; for a database that already has duplicates
-- from before this fix, merge each duplicate group down to one row first
-- (re-pointing anything that referenced a duplicate at the row being kept)
-- so the constraint can be added without losing orders, variants, specials,
-- or favorites.
DO $$
DECLARE
  dup RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'menu_items_category_id_name_key') THEN
    FOR dup IN
      SELECT category_id, name,
             (array_agg(id ORDER BY created_at, id))[1] AS keep_id,
             array_remove(array_agg(id ORDER BY created_at, id), (array_agg(id ORDER BY created_at, id))[1]) AS dupe_ids
      FROM menu_items
      GROUP BY category_id, name
      HAVING COUNT(*) > 1
    LOOP
      UPDATE order_items SET menu_item_id = dup.keep_id WHERE menu_item_id = ANY(dup.dupe_ids);

      INSERT INTO menu_item_variants (menu_item_id, label, price, display_order)
      SELECT dup.keep_id, v.label, v.price, v.display_order
      FROM menu_item_variants v
      WHERE v.menu_item_id = ANY(dup.dupe_ids)
      ON CONFLICT (menu_item_id, label) DO NOTHING;
      DELETE FROM menu_item_variants WHERE menu_item_id = ANY(dup.dupe_ids);

      INSERT INTO todays_specials (menu_item_id, discount_percent, is_featured, starts_at, ends_at)
      SELECT dup.keep_id, ts.discount_percent, ts.is_featured, ts.starts_at, ts.ends_at
      FROM todays_specials ts
      WHERE ts.menu_item_id = ANY(dup.dupe_ids)
      ON CONFLICT (menu_item_id) DO NOTHING;
      DELETE FROM todays_specials WHERE menu_item_id = ANY(dup.dupe_ids);

      INSERT INTO favorites (manager_id, menu_item_id)
      SELECT f.manager_id, dup.keep_id
      FROM favorites f
      WHERE f.menu_item_id = ANY(dup.dupe_ids)
      ON CONFLICT (manager_id, menu_item_id) DO NOTHING;
      DELETE FROM favorites WHERE menu_item_id = ANY(dup.dupe_ids);

      DELETE FROM menu_items WHERE id = ANY(dup.dupe_ids);
    END LOOP;

    ALTER TABLE menu_items ADD CONSTRAINT menu_items_category_id_name_key UNIQUE (category_id, name);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_menu_item_variants_menu_item_id ON menu_item_variants(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_is_available ON menu_items(is_available);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_manager_id ON notifications(manager_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_variant_id ON order_items(variant_id);
CREATE INDEX IF NOT EXISTS idx_split_bill_shares_split_bill_id ON split_bill_shares(split_bill_id);
CREATE INDEX IF NOT EXISTS idx_feedback_order_id ON feedback(order_id);
