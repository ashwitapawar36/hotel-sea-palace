BEGIN;

-- =========================================================
-- MANAGERS
-- Existing accounts and passwords are not overwritten.
-- Default password for newly inserted accounts: SeaPalace@123
-- =========================================================
-- Prevent menu changes while this migration runs.
LOCK TABLE menu_categories, menu_items
IN SHARE ROW EXCLUSIVE MODE;

-- Free the names required by the canonical categories.
-- Preserve the old category IDs and their linked records.
UPDATE menu_categories
SET name = 'Legacy Rice', updated_at = NOW()
WHERE slug = 'rice'
  AND name = 'Rice';

UPDATE menu_categories
SET name = 'Legacy Roti', updated_at = NOW()
WHERE slug = 'roti'
  AND name = 'Roti';

-- The seed below re-enables only the matched printed-menu items.
-- Other food records remain available for historical orders.
UPDATE menu_items mi
SET is_available = FALSE,
    updated_at = NOW()
FROM menu_categories mc
WHERE mc.id = mi.category_id
  AND mc.menu_type = 'food';

-- The PDF does not confirm that the ambiguous Rs 25 entry is Soda.
UPDATE menu_items mi
SET is_available = FALSE,
    updated_at = NOW()
FROM menu_categories mc
WHERE mc.id = mi.category_id
  AND mc.slug = 'cold-drinks--others'
  AND mi.name = 'Soda';

INSERT INTO managers (
  username, email, full_name, password_hash, role, is_active
)
VALUES
  (
    'admin',
    'admin@seapalace.com',
    'System Admin',
    crypt('SeaPalace@123', gen_salt('bf', 10)),
    'admin',
    TRUE
  ),
  (
    'manager',
    'manager@seapalace.com',
    'Restaurant Manager',
    crypt('SeaPalace@123', gen_salt('bf', 10)),
    'manager',
    TRUE
  )
ON CONFLICT (username) DO NOTHING;

-- =========================================================
-- RESTAURANT TABLES
-- Existing table statuses and capacities are preserved.
-- =========================================================

INSERT INTO restaurant_tables (
  table_number, capacity, status, location, qr_code_text
)
SELECT
  n,
  CASE
    WHEN n IN (4, 10, 15, 16) THEN 6
    WHEN n IN (2, 7, 13) THEN 2
    ELSE 4
  END,
  'available',
  CASE
    WHEN n IN (1, 7, 13) THEN 'Near Window'
    WHEN n IN (3, 8, 12) THEN 'Garden'
    WHEN n IN (4, 10, 15, 16) THEN 'Rooftop'
    ELSE 'Main Hall'
  END,
  'table-' || n
FROM generate_series(1, 16) AS t(n)
ON CONFLICT (table_number) DO NOTHING;

-- =========================================================
-- CATEGORY DEFINITIONS
--
-- food_group:
--   vegetarian     = Veg
--   non-vegetarian = Non-Veg
--   common         = Snacks & Sides
--   NULL           = Bar
--
-- Distinct stored names are required by UNIQUE(name).
-- =========================================================

CREATE TEMP TABLE seed_categories (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  menu_type TEXT NOT NULL,
  food_group TEXT,
  display_order INTEGER NOT NULL
) ON COMMIT DROP;

INSERT INTO seed_categories VALUES
  ('veg-starters', 'Veg Starters', 'food', 'vegetarian', 1),
  ('veg-main-course', 'Veg Main Course', 'food', 'vegetarian', 2),
  ('veg-chinese', 'Veg Chinese', 'food', 'vegetarian', 3),
  ('veg-biryani', 'Veg Biryani', 'food', 'vegetarian', 4),
  ('veg-thali', 'Veg Thali', 'food', 'vegetarian', 5),

  ('fish-starters', 'Fish Starters', 'food', 'non-vegetarian', 1),
  ('non-veg-starters', 'Non-Veg Starters', 'food', 'non-vegetarian', 2),
  ('tandoori-starters', 'Tandoori Starters', 'food', 'non-vegetarian', 3),
  ('mutton-main-course', 'Mutton Main Course', 'food', 'non-vegetarian', 4),
  ('chicken-main-course', 'Chicken Main Course', 'food', 'non-vegetarian', 5),
  ('fish', 'Fish', 'food', 'non-vegetarian', 6),
  ('non-veg-chinese', 'Non-Veg Chinese', 'food', 'non-vegetarian', 7),
  ('non-veg-biryani', 'Non-Veg Biryani', 'food', 'non-vegetarian', 8),
  ('non-veg-thali', 'Non-Veg Thali', 'food', 'non-vegetarian', 9),

  ('soup', 'Soup', 'food', 'common', 1),
  ('snacks', 'Snacks', 'food', 'common', 2),
  ('rice-khichadi', 'Rice', 'food', 'common', 3),
  ('roti-breads', 'Roti', 'food', 'common', 4),

  ('vodka', 'Vodka', 'bar', NULL, 1),
  ('beer--mild', 'Beer Mild', 'bar', NULL, 2),
  ('beer--strong', 'Beer Strong', 'bar', NULL, 3),
  ('cold-drinks--others', 'Cold Drinks', 'bar', NULL, 4),
  ('scotch', 'Scotch', 'bar', NULL, 5),
  ('premium-whiskey', 'Premium Whiskey', 'bar', NULL, 6),
  ('rum', 'Rum', 'bar', NULL, 7),
  ('whiskey', 'Whiskey', 'bar', NULL, 8);

-- Match by slug or final name, retaining category IDs.
-- If these identify two different rows, stop rather than
-- silently merge categories and their dishes.

DO $$
DECLARE
  r RECORD;
  matched_ids UUID[];
BEGIN
  FOR r IN SELECT * FROM seed_categories LOOP
    SELECT array_agg(id)
    INTO matched_ids
    FROM menu_categories
    WHERE slug = r.slug OR name = r.name;

    IF COALESCE(cardinality(matched_ids), 0) > 1 THEN
      RAISE EXCEPTION
        'Category conflict for "%": name and slug match different rows. Run the reviewed menu migration first.',
        r.name;
    ELSIF COALESCE(cardinality(matched_ids), 0) = 1 THEN
      UPDATE menu_categories
      SET
        name = r.name,
        slug = r.slug,
        menu_type = r.menu_type,
        food_group = r.food_group,
        display_order = r.display_order,
        updated_at = NOW()
      WHERE id = matched_ids[1];
    ELSE
      INSERT INTO menu_categories (
        name, slug, menu_type, food_group,
        description, display_order, is_active
      )
      VALUES (
        r.name, r.slug, r.menu_type, r.food_group,
        r.name || ' menu', r.display_order, TRUE
      );
    END IF;
  END LOOP;
END $$;

-- =========================================================
-- FOOD ITEMS
--
-- Keep existing spellings for matching existing item IDs.
-- Half/full dishes remain separate food items, compatible
-- with the current food card and cart implementation.
--
-- Paneer Handi appears twice on the printed menu at the
-- same price; it is represented once.
-- =========================================================

CREATE TEMP TABLE seed_items (
  category_slug TEXT NOT NULL REFERENCES seed_categories(slug),
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  is_veg BOOLEAN NOT NULL,
  is_alcoholic BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (category_slug, name)
) ON COMMIT DROP;

INSERT INTO seed_items (
  category_slug, name, price, is_veg
)
VALUES
  -- SOUP
  ('soup', 'Tomato Soup', 120, TRUE),
  ('soup', 'Veg Hot ''N'' Sour Soup', 120, TRUE),
  ('soup', 'Veg Manchow Soup', 120, TRUE),
  ('soup', 'Veg Sweet Corn Soup', 120, TRUE),

  -- SNACKS
  ('snacks', 'Paneer Pakoda', 240, TRUE),
  ('snacks', 'Veg Pakoda', 190, TRUE),
  ('snacks', 'Solkadhi', 60, TRUE),
  ('snacks', 'Schezwan Chatani', 30, TRUE),
  ('snacks', 'Egg Pakoda', 210, FALSE),

  -- VEG STARTERS
  ('veg-starters', 'Channa Garlic', 210, TRUE),
  ('veg-starters', 'Channa Koliwada', 220, TRUE),
  ('veg-starters', 'Channa Oil Fry', 210, TRUE),
  ('veg-starters', 'Finger Chips', 140, TRUE),
  ('veg-starters', 'Green Peas Garlic', 190, TRUE),
  ('veg-starters', 'Green Peas Oil Fry', 170, TRUE),
  ('veg-starters', 'Kaju Namkin', 290, TRUE),
  ('veg-starters', 'Mashroom Chilly', 280, TRUE),
  ('veg-starters', 'Paneer Chilly Dry / Crispy', 290, TRUE),
  ('veg-starters', 'Veg Chilly', 280, TRUE),
  ('veg-starters', 'Veg Crispy', 290, TRUE),
  ('veg-starters', 'Veg Manchurian Dry', 290, TRUE),
  ('veg-starters', 'Veg Schezwan Dry', 280, TRUE),

  -- VEG MAIN COURSE
  ('veg-main-course', 'Aloo Jeera', 180, TRUE),
  ('veg-main-course', 'Aloo Gobi', 210, TRUE),
  ('veg-main-course', 'Aloo Mutter', 210, TRUE),
  ('veg-main-course', 'Aloo Palak', 210, TRUE),
  ('veg-main-course', 'Aloo Shimla', 210, TRUE),
  ('veg-main-course', 'Aloo Tomato', 210, TRUE),
  ('veg-main-course', 'Dal Fry', 170, TRUE),
  ('veg-main-course', 'Chana Masala', 210, TRUE),
  ('veg-main-course', 'Dal Kolhapuri Tadka', 190, TRUE),
  ('veg-main-course', 'Green Peas Masala', 270, TRUE),
  ('veg-main-course', 'Kaju Masala', 260, TRUE),
  ('veg-main-course', 'Mix Veg', 240, TRUE),
  ('veg-main-course', 'Mashroom Cheese Masala', 310, TRUE),
  ('veg-main-course', 'Mashroom Masala', 280, TRUE),
  ('veg-main-course', 'Paneer Handi', 310, TRUE),
  ('veg-main-course', 'Paneer Butter Masala', 280, TRUE),
  ('veg-main-course', 'Paneer Chingari', 290, TRUE),
  ('veg-main-course', 'Paneer Kadai', 320, TRUE),
  ('veg-main-course', 'Paneer Kaju Masala', 290, TRUE),
  ('veg-main-course', 'Paneer Masala', 260, TRUE),
  ('veg-main-course', 'Paneer Mutter', 260, TRUE),
  ('veg-main-course', 'Paneer Palak', 260, TRUE),
  ('veg-main-course', 'Paneer Tikka Masala', 280, TRUE),
  ('veg-main-course', 'Paneer Bhurji', 280, TRUE),
  ('veg-main-course', 'Shimla Masala', 280, TRUE),
  ('veg-main-course', 'Veg Kadhai', 310, TRUE),
  ('veg-main-course', 'Veg Kolhapuri', 240, TRUE),
  ('veg-main-course', 'Veg Lasuni', 260, TRUE),
  ('veg-main-course', 'Veg Makhanwala', 260, TRUE),
  ('veg-main-course', 'Veg Maratha', 280, TRUE),
  ('veg-main-course', 'Mashroom Handi', 310, TRUE),
  ('veg-main-course', 'Mix Veg Handi', 290, TRUE),

  -- VEG CHINESE
  ('veg-chinese', 'Veg Schezwan Fried Rice', 220, TRUE),
  ('veg-chinese', 'Veg Manchurian Fried Rice', 280, TRUE),
  ('veg-chinese', 'Veg Triple Rice', 290, TRUE),
  ('veg-chinese', 'Veg Fried Rice', 200, TRUE),
  ('veg-chinese', 'Veg Hakka Noodles', 200, TRUE),
  ('veg-chinese', 'Mashroom Fried Rice', 210, TRUE),

  -- RICE
  ('rice-khichadi', 'Curd Rice', 180, TRUE),
  ('rice-khichadi', 'Palak Khichadi', 180, TRUE),
  ('rice-khichadi', 'Dal Khichadi', 190, TRUE),
  ('rice-khichadi', 'Dal Tadka Khichadi', 210, TRUE),
  ('rice-khichadi', 'Jeera Rice', 160, TRUE),
  ('rice-khichadi', 'Masala Rice', 210, TRUE),
  ('rice-khichadi', 'Steam Rice', 150, TRUE),
  ('rice-khichadi', 'Steam Rice (Half)', 80, TRUE),

  -- ROTI
  ('roti-breads', 'Tandori Roti', 25, TRUE),
  ('roti-breads', 'Butter Roti', 35, TRUE),
  ('roti-breads', 'Naan', 50, TRUE),
  ('roti-breads', 'Butter Naan', 60, TRUE),
  ('roti-breads', 'Butter Paratha', 60, TRUE),
  ('roti-breads', 'Bhakari', 30, TRUE),
  ('roti-breads', 'Chapati', 20, TRUE),
  ('roti-breads', 'Butter Chapati', 25, TRUE),
  ('roti-breads', 'Garlic Naan', 90, TRUE),
  ('roti-breads', 'Cheese Garlic Naan', 120, TRUE),

  -- VEG BIRYANI / PULAV
  ('veg-biryani', 'Mashroom Biryani', 260, TRUE),
  ('veg-biryani', 'Mashroom Pulav', 240, TRUE),
  ('veg-biryani', 'Paneer Biryani', 290, TRUE),
  ('veg-biryani', 'Paneer Pulav', 260, TRUE),
  ('veg-biryani', 'Veg Biryani', 240, TRUE),
  ('veg-biryani', 'Veg Pulav', 230, TRUE),

  -- VEG THALI
  ('veg-thali', 'Veg Thali', 170, TRUE),

  -- FISH STARTERS
  ('fish-starters', 'Prawns Chilly Dry', 510, FALSE),
  ('fish-starters', 'Prawns Koliwada', 510, FALSE),
  ('fish-starters', 'Fish Finger', 440, FALSE),
  ('fish-starters', 'Bombil Fry', 290, FALSE),
  ('fish-starters', 'Mandeli Fry', 210, FALSE),
  ('fish-starters', 'Pomfret Tawa / Rawa Fry', 510, FALSE),
  ('fish-starters', 'Surmai Tawa / Rawa Fry', 510, FALSE),
  ('fish-starters', 'Prawns Tawa / Rawa Fry', 510, FALSE),
  ('fish-starters', 'Bangda Tawa / Rawa Fry', 300, FALSE),

  -- NON-VEG STARTERS
  ('non-veg-starters', 'Boil Egg', 60, FALSE),
  ('non-veg-starters', 'Chicken 65', 320, FALSE),
  ('non-veg-starters', 'Chicken Chilly Dry', 290, FALSE),
  ('non-veg-starters', 'Chicken Crispy', 320, FALSE),
  ('non-veg-starters', 'Chicken Lollipop Masala Dry', 280, FALSE),
  ('non-veg-starters', 'Chicken Lollipop', 260, FALSE),
  ('non-veg-starters', 'Chicken Manchurian Dry', 290, FALSE),
  ('non-veg-starters', 'Chicken Oil Fry', 290, FALSE),
  ('non-veg-starters', 'Chicken Schezwan Dry', 290, FALSE),
  ('non-veg-starters', 'Chicken Garlic', 290, FALSE),
  ('non-veg-starters', 'Egg Bhurji', 120, FALSE),
  ('non-veg-starters', 'Egg Chilly', 220, FALSE),
  ('non-veg-starters', 'Egg Omlet', 90, FALSE),
  ('non-veg-starters', 'Half Fry', 90, FALSE),
  ('non-veg-starters', 'Liver Oil Fry', 250, FALSE),
  ('non-veg-starters', 'Chicken Fry', 290, FALSE),
  ('non-veg-starters', 'Mutton Fry', 410, FALSE),

  -- TANDOORI STARTERS
  ('tandoori-starters', 'Chicken Tikka', 310, FALSE),
  ('tandoori-starters', 'Chicken Tandoori Half', 260, FALSE),
  ('tandoori-starters', 'Chicken Tandoori Full', 430, FALSE),
  ('tandoori-starters', 'Chicken Pahadi Kabab', 310, FALSE),
  ('tandoori-starters', 'Chicken Boti Kabab', 320, FALSE),
  ('tandoori-starters', 'Chicken Lollipop Tandoori', 310, FALSE),
  ('tandoori-starters', 'Chicken Tangadi Kabab', 350, FALSE),
  ('tandoori-starters', 'Chicken Afagan Tandoori (Half)', 280, FALSE),
  ('tandoori-starters', 'Chicken Afagan Tandoori (Full)', 480, FALSE),
  ('tandoori-starters', 'Chicken Jangali Tandoori (Half)', 280, FALSE),
  ('tandoori-starters', 'Chicken Jangali Tandoori (Full)', 480, FALSE),
  ('tandoori-starters', 'Rozali Kabab', 320, FALSE),
  ('tandoori-starters', 'Chicken Reshmi Kabab', 320, FALSE),
  ('tandoori-starters', 'Chicken Lasooni Kabab', 320, FALSE),
  ('tandoori-starters', 'Chicken Family Platter', 1699, FALSE),

  -- MUTTON MAIN COURSE
  ('mutton-main-course', 'Mutton Masala', 390, FALSE),
  ('mutton-main-course', 'Mutton Kolhapuri', 390, FALSE),
  ('mutton-main-course', 'Mutton Hydrabadi', 390, FALSE),
  ('mutton-main-course', 'Mutton Lapeta', 410, FALSE),
  ('mutton-main-course', 'Mutton Kheema Masala', 410, FALSE),

  -- CHICKEN MAIN COURSE
  ('chicken-main-course', 'Chicken Masala', 280, FALSE),
  ('chicken-main-course', 'Chicken Kolhapuri', 290, FALSE),
  ('chicken-main-course', 'Chicken Tikka Masala', 340, FALSE),
  ('chicken-main-course', 'Chicken Moghlai', 310, FALSE),
  ('chicken-main-course', 'Chicken Hydrabadi', 290, FALSE),
  ('chicken-main-course', 'Chicken Kadhai', 320, FALSE),
  ('chicken-main-course', 'Chicken Lapeta', 310, FALSE),
  ('chicken-main-course', 'Chicken Afagani', 310, FALSE),
  ('chicken-main-course', 'Butter Chicken Full', 630, FALSE),
  ('chicken-main-course', 'Butter Chicken Half', 350, FALSE),
  ('chicken-main-course', 'Chicken Kheema Masala', 310, FALSE),
  ('chicken-main-course', 'Liver Masala', 240, FALSE),

  -- FISH MAIN DISHES
  ('fish', 'Bangda Masala', 320, FALSE),
  ('fish', 'Prawns Masala', 510, FALSE),
  ('fish', 'Prawns Fry', 510, FALSE),
  ('fish', 'Surmai Curry', 510, FALSE),
  ('fish', 'Surmai Masala', 510, FALSE),
  ('fish', 'Khekada Masala (Crab)', 390, FALSE),

  -- NON-VEG CHINESE
  ('non-veg-chinese', 'Chicken Fried Rice', 210, FALSE),
  ('non-veg-chinese', 'Chicken Schezwan Rice', 230, FALSE),
  ('non-veg-chinese', 'Chicken Triple Rice', 290, FALSE),
  ('non-veg-chinese', 'Chicken Manchurian Rice', 290, FALSE),
  ('non-veg-chinese', 'Chicken Hakka Noodles', 210, FALSE),
  ('non-veg-chinese', 'Chicken Schezwan Noodles', 230, FALSE),
  ('non-veg-chinese', 'Egg Fried Rice', 200, FALSE),
  ('non-veg-chinese', 'Egg Schezwan Rice', 210, FALSE),
  ('non-veg-chinese', 'Egg Triple Rice', 280, FALSE),
  ('non-veg-chinese', 'Egg Hakka Noodles', 200, FALSE),
  ('non-veg-chinese', 'Egg Schezwan Noodles', 220, FALSE),
  ('non-veg-chinese', 'Prawns Fried Rice', 470, FALSE),
  ('non-veg-chinese', 'Prawns Schezwan Rice', 460, FALSE),
  ('non-veg-chinese', 'Prawns Triple Rice', 520, FALSE),
  ('non-veg-chinese', 'Prawns Hakka Noodles', 450, FALSE),
  ('non-veg-chinese', 'Prawns Schezwan Noodles', 460, FALSE),

  -- NON-VEG BIRYANI / PULAV
  ('non-veg-biryani', 'Chicken Biryani', 270, FALSE),
  ('non-veg-biryani', 'Chicken Pulav', 260, FALSE),
  ('non-veg-biryani', 'Chicken Hydrabadi Biryani', 300, FALSE),
  ('non-veg-biryani', 'Mutton Biryani', 370, FALSE),
  ('non-veg-biryani', 'Prawns Biryani', 490, FALSE),
  ('non-veg-biryani', 'Prawns Pulav', 480, FALSE),
  ('non-veg-biryani', 'Egg Biryani', 250, FALSE),

  -- NON-VEG THALIS
  ('non-veg-thali', 'Egg Thali', 260, FALSE),
  ('non-veg-thali', 'Chicken Thali', 290, FALSE),
  ('non-veg-thali', 'Chicken Kolhapuri Thali', 310, FALSE),
  ('non-veg-thali', 'Chicken Kheema Thali', 310, FALSE),
  ('non-veg-thali', 'Butter Chicken Thali', 340, FALSE),
  ('non-veg-thali', 'Chicken Liver Thali', 260, FALSE),
  ('non-veg-thali', 'Chicken Kharda Thali', 310, FALSE),
  ('non-veg-thali', 'Chicken Kala Masala Thali', 310, FALSE),
  ('non-veg-thali', 'Mutton Thali', 370, FALSE),
  ('non-veg-thali', 'Mutton Kolhapuri Thali', 410, FALSE),
  ('non-veg-thali', 'Mutton Kheema Thali', 410, FALSE),
  ('non-veg-thali', 'Mutton Kala Masala Thali', 410, FALSE),
  ('non-veg-thali', 'Mutton Kharda Thali', 410, FALSE),
  ('non-veg-thali', 'Surmai Thali', 470, FALSE),
  ('non-veg-thali', 'Pomfret Thali', 510, FALSE),
  ('non-veg-thali', 'Prawns Thali', 510, FALSE),
  ('non-veg-thali', 'Bangda Thali', 320, FALSE),
  ('non-veg-thali', 'Bombil Thali', 320, FALSE);

-- =========================================================
-- BAR SPIRITS
-- Price columns correspond to the PDF's serving sizes.
-- =========================================================

CREATE TEMP TABLE seed_spirits (
  category_slug TEXT NOT NULL REFERENCES seed_categories(slug),
  name TEXT NOT NULL,
  p30 NUMERIC(10,2) NOT NULL,
  p60 NUMERIC(10,2) NOT NULL,
  p90 NUMERIC(10,2) NOT NULL,
  p180 NUMERIC(10,2) NOT NULL,
  PRIMARY KEY (category_slug, name)
) ON COMMIT DROP;

INSERT INTO seed_spirits VALUES
  -- VODKA
  ('vodka', 'Romanov', 80, 130, 190, 360),
  ('vodka', 'White Mischief', 90, 150, 220, 420),
  ('vodka', 'G Master', 100, 160, 230, 440),
  ('vodka', 'Smirnoff', 130, 230, 330, 610),
  ('vodka', 'Smirnoff Flavour', 140, 240, 350, 640),
  ('vodka', 'Magic Moments Flavour', 100, 160, 240, 450),
  ('vodka', 'Magic Moments', 90, 150, 220, 420),

  -- SCOTCH
  ('scotch', 'Indri', 400, 700, 1050, 1900),
  ('scotch', 'Vat 69', 200, 350, 510, 980),
  ('scotch', 'Black & White', 200, 380, 550, 990),
  ('scotch', 'Jameson', 200, 380, 550, 1050),
  ('scotch', 'Red Label', 190, 350, 510, 980),
  ('scotch', 'Black Label', 270, 530, 790, 1540),
  ('scotch', 'Ballantine''s', 180, 350, 480, 950),
  ('scotch', 'J&B', 180, 350, 480, 950),
  ('scotch', '100 Pipers', 180, 350, 520, 1010),

  -- PREMIUM WHISKEY
  ('premium-whiskey', 'Blenders Pride', 120, 210, 310, 590),
  ('premium-whiskey', 'American Pride', 120, 210, 310, 590),
  ('premium-whiskey', 'Antiquity', 110, 230, 340, 620),
  ('premium-whiskey', 'Signature', 110, 210, 310, 580),
  ('premium-whiskey', 'Legacy', 110, 210, 310, 590),
  ('premium-whiskey', 'Rockford', 110, 210, 310, 590),
  ('premium-whiskey', 'Oaksmith Silver', 90, 170, 250, 480),
  ('premium-whiskey', 'Oaksmith Gold', 120, 210, 310, 600),

  -- RUM
  ('rum', 'Old Monk', 70, 130, 190, 360),
  ('rum', 'McDowell''s No.1 Rum', 70, 130, 190, 360),
  ('rum', 'Bacardi Black', 90, 140, 210, 390),
  ('rum', 'Bacardi White', 130, 220, 330, 610),
  ('rum', 'Bacardi Lemon', 140, 240, 350, 640),

  -- WHISKEY
  ('whiskey', 'Imperial Blue', 80, 130, 190, 360),
  ('whiskey', 'DSP Black', 80, 130, 190, 360),
  ('whiskey', 'McDowell''s No.1', 80, 130, 190, 360),
  ('whiskey', 'Royal Stag Barrel', 100, 170, 240, 440),
  ('whiskey', 'Royal Stag', 90, 140, 210, 380),
  ('whiskey', 'Royal Challenge', 90, 140, 210, 390),
  ('whiskey', 'OCB', 80, 130, 190, 360),
  ('whiskey', 'The Glenwalk', 120, 190, 260, 460),
  ('whiskey', 'Iconic', 80, 130, 190, 360),
  ('whiskey', 'B7', 80, 130, 190, 360),
  ('whiskey', 'B10', 90, 140, 210, 390);

-- =========================================================
-- BEER
-- =========================================================

CREATE TEMP TABLE seed_beers (
  category_slug TEXT NOT NULL REFERENCES seed_categories(slug),
  name TEXT NOT NULL,
  p500 NUMERIC(10,2) NOT NULL,
  p650 NUMERIC(10,2) NOT NULL,
  PRIMARY KEY (category_slug, name)
) ON COMMIT DROP;

INSERT INTO seed_beers VALUES
  ('beer--mild', 'Kingfisher (Mild)', 270, 330),
  ('beer--mild', 'Tuborg (Mild)', 260, 310),
  ('beer--mild', 'London Pilsner', 220, 270),
  ('beer--mild', 'Carlsberg (Mild)', 280, 370),
  ('beer--mild', 'Budweiser (Mild)', 280, 370),

  ('beer--strong', 'Kingfisher Strong', 260, 310),
  ('beer--strong', 'Tuborg Strong', 260, 320),
  ('beer--strong', 'London Pilsner Strong', 220, 270),
  ('beer--strong', 'Carlsberg Strong', 280, 390),
  ('beer--strong', 'Budweiser Magnum', 280, 390);

-- =========================================================
-- COLD DRINKS
--
-- "Serving" avoids inventing a volume absent from the PDF.
-- Breezer/Rio retain the alcoholic classification from
-- the supplied project; verify the actual stocked products.
--
-- The ambiguous second "cold drink 600 ml" at Rs 25 is not
-- inserted as "Soda". Any existing Soda row is left intact
-- for review during migration.
-- =========================================================

CREATE TEMP TABLE seed_cold_drinks (
  name TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  is_alcoholic BOOLEAN NOT NULL
) ON COMMIT DROP;

INSERT INTO seed_cold_drinks VALUES
  ('Cold Drink', '600 ml', 60, FALSE),
  ('Mineral Water', 'Serving', 25, FALSE),
  ('Solkadhi', 'Serving', 50, FALSE),
  ('Buttermilk', 'Serving', 60, FALSE),
  ('Red Bull', 'Serving', 220, FALSE),
  ('Breezer', 'Serving', 260, TRUE),
  ('Rio', 'Serving', 90, TRUE),
  ('Small Water', 'Serving', 15, FALSE);

INSERT INTO seed_items (
  category_slug, name, price, is_veg, is_alcoholic
)
SELECT category_slug, name, p30, TRUE, TRUE
FROM seed_spirits;

INSERT INTO seed_items (
  category_slug, name, price, is_veg, is_alcoholic
)
SELECT category_slug, name, p500, TRUE, TRUE
FROM seed_beers;

INSERT INTO seed_items (
  category_slug, name, price, is_veg, is_alcoholic
)
SELECT
  'cold-drinks--others',
  name,
  price,
  TRUE,
  is_alcoholic
FROM seed_cold_drinks;

-- =========================================================
-- APPLY MENU ITEMS
--
-- Prefer a match already in the target category.
-- Otherwise reuse a unique same-name item in the same
-- menu_type, moving it without changing its ID.
--
-- This keeps food/bar Solkadhi separate.
-- Multiple possible legacy matches cause a rollback.
--
-- Existing descriptions, images, availability and prep
-- times are preserved. New items use the schema defaults
-- and no invented image URL.
-- =========================================================

DO $$
DECLARE
  r RECORD;
  target_category_id UUID;
  matched_item_id UUID;
  candidate_ids UUID[];
BEGIN
  LOCK TABLE menu_items IN SHARE ROW EXCLUSIVE MODE;

  FOR r IN
    SELECT s.*, c.menu_type, c.name AS category_name
    FROM seed_items s
    JOIN seed_categories c ON c.slug = s.category_slug
    ORDER BY s.category_slug, s.name
  LOOP
    SELECT id
    INTO STRICT target_category_id
    FROM menu_categories
    WHERE slug = r.category_slug;

    matched_item_id := NULL;

    SELECT id
    INTO matched_item_id
    FROM menu_items
    WHERE category_id = target_category_id
      AND name = r.name;

    IF matched_item_id IS NULL THEN
      -- When several same-name legacy records exist, prefer the
-- one referenced by the most order lines.
-- Other copies remain stored, but unavailable.
SELECT ARRAY[mi.id]
INTO candidate_ids
FROM menu_items mi
JOIN menu_categories mc ON mc.id = mi.category_id
WHERE mi.name = r.name
  AND mc.menu_type = r.menu_type
ORDER BY
  (
    SELECT COUNT(*)
    FROM order_items oi
    WHERE oi.menu_item_id = mi.id
  ) DESC,
  mi.created_at ASC,
  mi.id ASC
LIMIT 1;

      IF COALESCE(cardinality(candidate_ids), 0) > 1 THEN
        RAISE EXCEPTION
          'Multiple legacy matches for "%". Resolve them in the menu migration before seeding.',
          r.name;
      ELSIF COALESCE(cardinality(candidate_ids), 0) = 1 THEN
        matched_item_id := candidate_ids[1];
      END IF;
    END IF;

    IF matched_item_id IS NOT NULL THEN
      UPDATE menu_items
SET
  category_id = target_category_id,
  price = r.price,
  is_veg = r.is_veg,
  is_alcoholic = r.is_alcoholic,
  is_available = TRUE,
  updated_at = NOW()
WHERE id = matched_item_id;
    ELSE
      INSERT INTO menu_items (
        category_id,
        name,
        description,
        price,
        is_veg,
        is_alcoholic
      )
      VALUES (
        target_category_id,
        r.name,
        r.category_name || ' from Hotel Sea Palace',
        r.price,
        r.is_veg,
        r.is_alcoholic
      );
    END IF;
  END LOOP;
END $$;

-- =========================================================
-- VARIANTS
-- Category + item name identify the correct drink.
-- Upserts retain existing variant IDs and order references.
-- =========================================================

CREATE TEMP TABLE seed_variants (
  category_slug TEXT NOT NULL,
  item_name TEXT NOT NULL,
  label TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  display_order INTEGER NOT NULL,
  PRIMARY KEY (category_slug, item_name, label),
  FOREIGN KEY (category_slug, item_name)
    REFERENCES seed_items(category_slug, name)
) ON COMMIT DROP;

INSERT INTO seed_variants
SELECT
  s.category_slug,
  s.name,
  v.label,
  v.price,
  v.display_order
FROM seed_spirits s
CROSS JOIN LATERAL (
  VALUES
    ('30 ml', s.p30, 1),
    ('60 ml', s.p60, 2),
    ('90 ml', s.p90, 3),
    ('180 ml', s.p180, 4)
) AS v(label, price, display_order);

INSERT INTO seed_variants
SELECT
  b.category_slug,
  b.name,
  v.label,
  v.price,
  v.display_order
FROM seed_beers b
CROSS JOIN LATERAL (
  VALUES
    ('500 ml', b.p500, 1),
    ('650 ml', b.p650, 2)
) AS v(label, price, display_order);

-- Preserve an existing single-serving label, such as Glass
-- or Bottle, rather than adding a duplicate "Serving".
-- Stop if multiple existing variants make the match unclear.

DO $$
DECLARE
  r RECORD;
  item_id UUID;
  existing_labels TEXT[];
  chosen_label TEXT;
BEGIN
  FOR r IN SELECT * FROM seed_cold_drinks LOOP
    SELECT mi.id
    INTO STRICT item_id
    FROM menu_items mi
    JOIN menu_categories mc ON mc.id = mi.category_id
    WHERE mc.slug = 'cold-drinks--others'
      AND mi.name = r.name;

    SELECT array_agg(label ORDER BY display_order, id)
    INTO existing_labels
    FROM menu_item_variants
    WHERE menu_item_id = item_id;

    IF COALESCE(cardinality(existing_labels), 0) > 1 THEN
      RAISE EXCEPTION
        'Drink "%" has multiple existing variants. Review its serving sizes before seeding.',
        r.name;
    END IF;

    chosen_label := r.label;

    IF COALESCE(cardinality(existing_labels), 0) = 1 THEN
      chosen_label := existing_labels[1];

      IF r.name = 'Cold Drink' AND chosen_label <> '600 ml' THEN
        RAISE EXCEPTION
          'Cold Drink has variant "%", but the confirmed PDF entry is 600 ml. Review before seeding.',
          chosen_label;
      END IF;
    END IF;

    INSERT INTO seed_variants VALUES (
      'cold-drinks--others',
      r.name,
      chosen_label,
      r.price,
      1
    );
  END LOOP;
END $$;

INSERT INTO menu_item_variants (
  menu_item_id, label, price, display_order
)
SELECT
  mi.id,
  sv.label,
  sv.price,
  sv.display_order
FROM seed_variants sv
JOIN menu_categories mc
  ON mc.slug = sv.category_slug
JOIN menu_items mi
  ON mi.category_id = mc.id
 AND mi.name = sv.item_name
ON CONFLICT (menu_item_id, label)
DO UPDATE SET
  price = EXCLUDED.price,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- =========================================================
-- TODAY'S SPECIALS
-- Preserve existing manager-selected promotions.
-- Only add defaults if an item has no special record.
-- =========================================================

INSERT INTO todays_specials (
  menu_item_id, discount_percent, is_featured
)
SELECT mi.id, 10, TRUE
FROM menu_items mi
JOIN menu_categories mc ON mc.id = mi.category_id
JOIN (
  VALUES
    ('tandoori-starters', 'Chicken Family Platter'),
    ('fish-starters', 'Pomfret Tawa / Rawa Fry'),
    ('mutton-main-course', 'Mutton Kolhapuri'),
    ('non-veg-biryani', 'Chicken Biryani')
) AS s(slug, name)
  ON mc.slug = s.slug
 AND mi.name = s.name
ON CONFLICT (menu_item_id) DO NOTHING;

-- =========================================================
-- SETTINGS
-- Retains the supplied project's configured rate defaults.
-- Existing settings are not overwritten.
-- =========================================================

INSERT INTO restaurant_settings (key, value, description)
VALUES
  ('restaurant_name', 'Hotel Sea Palace', 'Restaurant display name'),
  ('currency', 'INR', 'Default currency'),
  ('cgst_rate', '2.5', 'Configured CGST percent on non-alcoholic items'),
  ('sgst_rate', '2.5', 'Configured SGST percent on non-alcoholic items'),
  ('vat_rate', '10', 'Configured VAT percent on alcoholic items'),
  ('service_charge', '0', 'Service charge percentage')
ON CONFLICT (key) DO NOTHING;

-- Legacy categories/items are deliberately retained here.
-- The reviewed migration will handle obsolete sample dishes,
-- duplicate matches and empty old categories separately.
-- No orders, bills or historical line prices are changed.

COMMIT;