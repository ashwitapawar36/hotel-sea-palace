BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================
-- MANAGERS
-- =========================================================

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

  CONSTRAINT managers_role_check
    CHECK (role IN ('manager', 'owner', 'admin'))
);

-- =========================================================
-- RESTAURANT TABLES
-- =========================================================

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number INTEGER NOT NULL UNIQUE,
  capacity INTEGER NOT NULL DEFAULT 4,
  status VARCHAR(20) NOT NULL DEFAULT 'available',
  location VARCHAR(100),
  qr_code_text VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT restaurant_tables_status_check
    CHECK (
      status IN (
        'available',
        'occupied',
        'reserved',
        'out_of_service'
      )
    ),

  CONSTRAINT restaurant_tables_capacity_check
    CHECK (capacity > 0)
);

-- =========================================================
-- MENU CATEGORIES
--
-- menu_type:
--   food
--   bar
--
-- food_group:
--   vegetarian      -> Veg tab
--   non-vegetarian  -> Non-Veg tab
--   common          -> Snacks & Sides tab
--   NULL            -> Bar or legacy unassigned food category
--
-- NULL remains allowed for legacy food categories until the
-- menu migration assigns them explicitly.
--
-- Names and slugs remain globally unique for compatibility.
-- Use separate stored categories such as:
--   Veg Biryani / Non-Veg Biryani
--   Veg Thali / Non-Veg Thali
--
-- Category creation, renaming and dish reassignment belong
-- in the menu migration and seed, not in this schema file.
-- =========================================================

CREATE TABLE IF NOT EXISTS menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  menu_type VARCHAR(20) NOT NULL DEFAULT 'food',
  food_group VARCHAR(20),
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT menu_categories_menu_type_check
    CHECK (menu_type IN ('food', 'bar'))
);

ALTER TABLE menu_categories
  ADD COLUMN IF NOT EXISTS food_group VARCHAR(20);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'menu_categories_food_group_check'
      AND conrelid = 'menu_categories'::regclass
  ) THEN
    ALTER TABLE menu_categories
      ADD CONSTRAINT menu_categories_food_group_check
      CHECK (
        food_group IS NULL
        OR (
          menu_type = 'food'
          AND food_group IN (
            'vegetarian',
            'non-vegetarian',
            'common'
          )
        )
      );
  END IF;
END $$;

-- =========================================================
-- MENU ITEMS
--
-- is_veg describes the individual dish.
-- A common category can contain both veg and non-veg items.
--
-- is_alcoholic is independent of menu_type because the bar
-- menu also contains non-alcoholic drinks.
-- =========================================================

CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  category_id UUID NOT NULL
    REFERENCES menu_categories(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  name VARCHAR(150) NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  is_veg BOOLEAN NOT NULL DEFAULT TRUE,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  is_alcoholic BOOLEAN NOT NULL DEFAULT FALSE,
  preparation_time_minutes INTEGER NOT NULL DEFAULT 15,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT menu_items_price_check
    CHECK (price >= 0)
);

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE menu_items
  ALTER COLUMN image_url TYPE TEXT;

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS is_alcoholic
    BOOLEAN NOT NULL DEFAULT FALSE;

-- =========================================================
-- MENU ITEM VARIANTS
--
-- Examples:
--   30 ml / 60 ml / 90 ml / 180 ml
--   500 ml / 650 ml
--   Half / Full
--
-- Preserve variant IDs when editing variants already used
-- by orders. The controller must not delete and recreate
-- those variants.
-- =========================================================

CREATE TABLE IF NOT EXISTS menu_item_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  menu_item_id UUID NOT NULL
    REFERENCES menu_items(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  label VARCHAR(50) NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT menu_item_variants_price_check
    CHECK (price >= 0),

  UNIQUE (menu_item_id, label)
);

-- =========================================================
-- TODAY'S SPECIALS
-- =========================================================

CREATE TABLE IF NOT EXISTS todays_specials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  menu_item_id UUID NOT NULL UNIQUE
    REFERENCES menu_items(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  discount_percent NUMERIC(5,2) DEFAULT 0,
  is_featured BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- ORDERS
-- =========================================================

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  table_id UUID
    REFERENCES restaurant_tables(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  manager_id UUID
    REFERENCES managers(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

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

  CONSTRAINT orders_status_check
    CHECK (
      status IN (
        'pending',
        'accepted',
        'preparing',
        'ready',
        'completed',
        'cancelled'
      )
    ),

  CONSTRAINT orders_payment_status_check
    CHECK (payment_status IN ('unpaid', 'partial', 'paid')),

  CONSTRAINT orders_payment_method_check
    CHECK (
      payment_method IS NULL
      OR payment_method IN ('cash', 'card', 'upi', 'split')
    )
);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_payment_method_check'
      AND conrelid = 'orders'::regclass
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_payment_method_check
      CHECK (
        payment_method IS NULL
        OR payment_method IN ('cash', 'card', 'upi', 'split')
      );
  END IF;
END $$;

-- These additions do not reconstruct historical tax splits.
-- Existing subtotal, tax_amount and total_amount are preserved.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS food_subtotal
    NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS alcohol_subtotal
    NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cgst_amount
    NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS sgst_amount
    NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS vat_amount
    NUMERIC(10,2) NOT NULL DEFAULT 0;

-- =========================================================
-- ORDER ITEMS
-- =========================================================

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  order_id UUID NOT NULL
    REFERENCES orders(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  menu_item_id UUID NOT NULL
    REFERENCES menu_items(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  variant_id UUID
    REFERENCES menu_item_variants(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT order_items_quantity_check
    CHECK (quantity > 0)
);

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS variant_id UUID
    REFERENCES menu_item_variants(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- =========================================================
-- BILLS
-- =========================================================

CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  order_id UUID NOT NULL UNIQUE
    REFERENCES orders(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  bill_number VARCHAR(50) NOT NULL UNIQUE,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(30),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT bills_payment_method_check
    CHECK (
      payment_method IS NULL
      OR payment_method IN ('cash', 'card', 'upi', 'split')
    )
);

ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30);

ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Creating an invoice must not automatically imply payment.
ALTER TABLE bills
  ALTER COLUMN payment_method DROP DEFAULT;

ALTER TABLE bills
  ALTER COLUMN payment_method DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bills_payment_method_check'
      AND conrelid = 'bills'::regclass
  ) THEN
    ALTER TABLE bills
      ADD CONSTRAINT bills_payment_method_check
      CHECK (
        payment_method IS NULL
        OR payment_method IN ('cash', 'card', 'upi', 'split')
      );
  END IF;
END $$;

ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS food_subtotal
    NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS alcohol_subtotal
    NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS cgst_amount
    NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS sgst_amount
    NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS vat_amount
    NUMERIC(10,2) NOT NULL DEFAULT 0;

-- =========================================================
-- SPLIT BILLS
-- =========================================================

CREATE TABLE IF NOT EXISTS split_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  order_id UUID NOT NULL UNIQUE
    REFERENCES orders(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  people_count INTEGER NOT NULL DEFAULT 1,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT split_bills_people_count_check
    CHECK (people_count > 0)
);

CREATE TABLE IF NOT EXISTS split_bill_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  split_bill_id UUID NOT NULL
    REFERENCES split_bills(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  person_name VARCHAR(150) NOT NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_paid BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT split_bill_shares_amount_check
    CHECK (amount >= 0)
);

-- =========================================================
-- FEEDBACK
-- =========================================================

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  order_id UUID NOT NULL UNIQUE
    REFERENCES orders(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  rating SMALLINT NOT NULL,
  comment TEXT,
  recommend BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT feedback_rating_check
    CHECK (rating BETWEEN 1 AND 5)
);

-- =========================================================
-- NOTIFICATIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  manager_id UUID
    REFERENCES managers(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  order_id UUID
    REFERENCES orders(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(30) NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT notifications_type_check
    CHECK (type IN ('info', 'order', 'payment', 'stock', 'system'))
);

-- =========================================================
-- FAVORITES
-- =========================================================

CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  manager_id UUID NOT NULL
    REFERENCES managers(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  menu_item_id UUID NOT NULL
    REFERENCES menu_items(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (manager_id, menu_item_id)
);

-- =========================================================
-- RESTAURANT SETTINGS
-- =========================================================

CREATE TABLE IF NOT EXISTS restaurant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- CLEAN UP LEGACY DUPLICATE MENU ITEMS
--
-- Older seeds could insert the same dish repeatedly.
-- Keep the oldest item within each (category_id, name) group.
--
-- Preserve order rows and their stored prices/quantities.
-- Move variants where possible, preserving their IDs.
-- If the retained item already has the same variant label,
-- repoint order references before deleting that duplicate.
--
-- For conflicting current menu values, the oldest retained
-- item/variant wins. The upcoming menu seed sets menu prices.
-- =========================================================

DO $$
DECLARE
  duplicate_group RECORD;
  duplicate_variant RECORD;
  retained_variant_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'menu_items_category_id_name_key'
      AND conrelid = 'menu_items'::regclass
  ) THEN

    -- Prevent concurrent writes while references are merged.
    LOCK TABLE
      menu_items,
      menu_item_variants,
      order_items,
      todays_specials,
      favorites
    IN SHARE ROW EXCLUSIVE MODE;

    FOR duplicate_group IN
      SELECT
        category_id,
        name,
        (array_agg(id ORDER BY created_at, id))[1] AS keep_id,
        array_remove(
          array_agg(id ORDER BY created_at, id),
          (array_agg(id ORDER BY created_at, id))[1]
        ) AS duplicate_ids
      FROM menu_items
      GROUP BY category_id, name
      HAVING COUNT(*) > 1
    LOOP

      FOR duplicate_variant IN
        SELECT id, label
        FROM menu_item_variants
        WHERE menu_item_id = ANY(duplicate_group.duplicate_ids)
        ORDER BY created_at, id
      LOOP
        retained_variant_id := NULL;

        SELECT id
        INTO retained_variant_id
        FROM menu_item_variants
        WHERE menu_item_id = duplicate_group.keep_id
          AND label = duplicate_variant.label;

        IF retained_variant_id IS NULL THEN
          -- No label conflict: preserve the original variant ID.
          UPDATE menu_item_variants
          SET
            menu_item_id = duplicate_group.keep_id,
            updated_at = NOW()
          WHERE id = duplicate_variant.id;
        ELSE
          -- Repoint references before removing this variant.
          UPDATE order_items
          SET
            variant_id = retained_variant_id,
            updated_at = NOW()
          WHERE variant_id = duplicate_variant.id;

          DELETE FROM menu_item_variants
          WHERE id = duplicate_variant.id;
        END IF;
      END LOOP;

      UPDATE order_items
      SET
        menu_item_id = duplicate_group.keep_id,
        updated_at = NOW()
      WHERE menu_item_id = ANY(duplicate_group.duplicate_ids);

      INSERT INTO todays_specials (
        menu_item_id,
        discount_percent,
        is_featured,
        starts_at,
        ends_at
      )
      SELECT
        duplicate_group.keep_id,
        discount_percent,
        is_featured,
        starts_at,
        ends_at
      FROM todays_specials
      WHERE menu_item_id = ANY(duplicate_group.duplicate_ids)
      ORDER BY created_at, id
      ON CONFLICT (menu_item_id) DO NOTHING;

      DELETE FROM todays_specials
      WHERE menu_item_id = ANY(duplicate_group.duplicate_ids);

      INSERT INTO favorites (manager_id, menu_item_id)
      SELECT DISTINCT
        manager_id,
        duplicate_group.keep_id
      FROM favorites
      WHERE menu_item_id = ANY(duplicate_group.duplicate_ids)
      ON CONFLICT (manager_id, menu_item_id) DO NOTHING;

      DELETE FROM favorites
      WHERE menu_item_id = ANY(duplicate_group.duplicate_ids);

      DELETE FROM menu_items
      WHERE id = ANY(duplicate_group.duplicate_ids);

    END LOOP;

    ALTER TABLE menu_items
      ADD CONSTRAINT menu_items_category_id_name_key
      UNIQUE (category_id, name);

  END IF;
END $$;

-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_menu_categories_type_group_order
  ON menu_categories(menu_type, food_group, display_order);

CREATE INDEX IF NOT EXISTS idx_menu_item_variants_menu_item_id
  ON menu_item_variants(menu_item_id);

CREATE INDEX IF NOT EXISTS idx_menu_items_category_id
  ON menu_items(category_id);

CREATE INDEX IF NOT EXISTS idx_menu_items_is_available
  ON menu_items(is_available);

CREATE INDEX IF NOT EXISTS idx_orders_status
  ON orders(status);

CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_manager_id
  ON notifications(manager_id);

CREATE INDEX IF NOT EXISTS idx_notifications_is_read
  ON notifications(is_read);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_variant_id
  ON order_items(variant_id);

CREATE INDEX IF NOT EXISTS idx_split_bill_shares_split_bill_id
  ON split_bill_shares(split_bill_id);

CREATE INDEX IF NOT EXISTS idx_feedback_order_id
  ON feedback(order_id);

COMMIT;