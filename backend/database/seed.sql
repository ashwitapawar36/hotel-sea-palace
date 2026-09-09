-- Seed managers
-- Default credentials for local/dev use (change before production):
--   username: admin     password: SeaPalace@123
--   username: manager   password: SeaPalace@123
INSERT INTO managers (username, email, full_name, password_hash, role, is_active)
VALUES
  ('admin', 'admin@seapalace.com', 'System Admin', '$2b$10$Z2LuDX44DXswztrgXgktt.XQoIiLlojGSChsQPnn0whQSS9Nl8xfy', 'admin', TRUE),
  ('manager', 'manager@seapalace.com', 'Restaurant Manager', '$2b$10$Z2LuDX44DXswztrgXgktt.XQoIiLlojGSChsQPnn0whQSS9Nl8xfy', 'manager', TRUE)
ON CONFLICT (username) DO NOTHING;

-- Seed restaurant tables
INSERT INTO restaurant_tables (table_number, capacity, status, location, qr_code_text)
VALUES
  (1, 4, 'available', 'Near Window', 'table-1'),
  (2, 2, 'occupied', 'Main Hall', 'table-2'),
  (3, 4, 'reserved', 'Garden', 'table-3'),
  (4, 6, 'available', 'Rooftop', 'table-4'),
  (5, 4, 'available', 'Main Hall', 'table-5'),
  (6, 4, 'available', 'Main Hall', 'table-6'),
  (7, 2, 'available', 'Near Window', 'table-7'),
  (8, 4, 'available', 'Garden', 'table-8'),
  (9, 4, 'available', 'Main Hall', 'table-9'),
  (10, 6, 'available', 'Rooftop', 'table-10'),
  (11, 4, 'available', 'Main Hall', 'table-11'),
  (12, 4, 'available', 'Garden', 'table-12'),
  (13, 2, 'available', 'Near Window', 'table-13'),
  (14, 4, 'available', 'Main Hall', 'table-14'),
  (15, 4, 'available', 'Rooftop', 'table-15'),
  (16, 6, 'available', 'Rooftop', 'table-16')
ON CONFLICT (table_number) DO NOTHING;

-- Seed categories (food menu + bar menu)
-- Seed categories (food menu + bar menu). Food categories carry a
-- food_group ('vegetarian' | 'non-vegetarian') so the customer-facing menu
-- can group them into the two required top-level sections; Bar categories
-- never set it, since Bar has no such split. Existing slugs are kept as-is
-- (only display names/order/food_group change) to avoid touching anything
-- that already references a category by slug.
INSERT INTO menu_categories (name, slug, menu_type, food_group, description, display_order, is_active)
VALUES
  ('Soup', 'soup', 'food', 'vegetarian', 'Soup menu', 1, TRUE),
  ('Snacks', 'snacks', 'food', 'vegetarian', 'Snacks menu', 2, TRUE),
  ('Starters', 'veg-starters', 'food', 'vegetarian', 'Starters menu', 3, TRUE),
  ('Main Course', 'veg-main-course', 'food', 'vegetarian', 'Main Course menu', 4, TRUE),
  ('Chinese', 'veg-chinese', 'food', 'vegetarian', 'Chinese menu', 5, TRUE),
  ('Rice & Biryani', 'rice-khichadi', 'food', 'vegetarian', 'Rice & Biryani menu', 6, TRUE),
  ('Roti & Breads', 'roti-breads', 'food', 'vegetarian', 'Roti & Breads menu', 7, TRUE),
  ('Thali', 'veg-thali', 'food', 'vegetarian', 'Thali menu', 8, TRUE),
  ('Egg Items', 'egg-items', 'food', 'non-vegetarian', 'Egg Items menu', 9, TRUE),
  ('Chicken Starters & Tandoori', 'chicken-starters-tandoori', 'food', 'non-vegetarian', 'Chicken Starters & Tandoori menu', 10, TRUE),
  ('Chicken Main Course & Biryani', 'chicken-main-course-biryani', 'food', 'non-vegetarian', 'Chicken Main Course & Biryani menu', 11, TRUE),
  ('Chicken Thalis', 'chicken-thalis', 'food', 'non-vegetarian', 'Chicken Thalis menu', 12, TRUE),
  ('Mutton & Liver Items', 'mutton-liver-items', 'food', 'non-vegetarian', 'Mutton & Liver Items menu', 13, TRUE),
  ('Fish & Seafood', 'fish-seafood', 'food', 'non-vegetarian', 'Fish & Seafood menu', 14, TRUE),
  ('Seafood Thalis', 'seafood-thalis', 'food', 'non-vegetarian', 'Seafood Thalis menu', 15, TRUE),
  ('Vodka', 'vodka', 'bar', NULL, 'Vodka selection', 16, TRUE),
  ('Scotch', 'scotch', 'bar', NULL, 'Scotch selection', 17, TRUE),
  ('Premium Whiskey', 'premium-whiskey', 'bar', NULL, 'Premium Whiskey selection', 18, TRUE),
  ('Whiskey', 'whiskey', 'bar', NULL, 'Whiskey selection', 19, TRUE),
  ('Rum', 'rum', 'bar', NULL, 'Rum selection', 20, TRUE),
  ('Beer - Mild', 'beer--mild', 'bar', NULL, 'Beer - Mild selection', 21, TRUE),
  ('Beer - Strong', 'beer--strong', 'bar', NULL, 'Beer - Strong selection', 22, TRUE),
  ('Cold Drinks & Others', 'cold-drinks--others', 'bar', NULL, 'Cold Drinks & Others selection', 23, TRUE)
-- ON CONFLICT targets `name`, not `slug`: schema.sql's migration above
-- guarantees every category already has its final canonical *name* by the
-- time this runs, regardless of which slug a given database's history left
-- it with (a database upgraded through an earlier version of this project
-- may have a different slug for the same category name) - matching on slug
-- here would insert a second row and crash on the separate UNIQUE(name)
-- constraint instead of safely no-op'ing.
ON CONFLICT (name) DO NOTHING;

-- Seed food menu items
WITH cat AS (
  SELECT id, slug FROM menu_categories
)
INSERT INTO menu_items (category_id, name, description, price, image_url, is_veg, is_available, preparation_time_minutes)
SELECT c.id, v.name, v.description, v.price, v.image_url, v.is_veg, TRUE, 15
FROM (
  VALUES
    ('roti-breads', 'Tandori Roti', 'Roti & Breads special from Hotel Sea Palace''s kitchen', 25.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_Roti.JPG?width=480', TRUE),
    ('roti-breads', 'Butter Roti', 'Roti & Breads special from Hotel Sea Palace''s kitchen', 35.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_Roti.JPG?width=480', TRUE),
    ('roti-breads', 'Naan', 'Roti & Breads special from Hotel Sea Palace''s kitchen', 50.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_Roti.JPG?width=480', TRUE),
    ('roti-breads', 'Butter Naan', 'Roti & Breads special from Hotel Sea Palace''s kitchen', 60.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_Roti.JPG?width=480', TRUE),
    ('roti-breads', 'Butter Paratha', 'Roti & Breads special from Hotel Sea Palace''s kitchen', 60.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_Roti.JPG?width=480', TRUE),
    ('roti-breads', 'Bhakari', 'Roti & Breads special from Hotel Sea Palace''s kitchen', 30.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_Roti.JPG?width=480', TRUE),
    ('roti-breads', 'Chapati', 'Roti & Breads special from Hotel Sea Palace''s kitchen', 20.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_Roti.JPG?width=480', TRUE),
    ('roti-breads', 'Butter Chapati', 'Roti & Breads special from Hotel Sea Palace''s kitchen', 25.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_Roti.JPG?width=480', TRUE),
    ('roti-breads', 'Garlic Naan', 'Roti & Breads special from Hotel Sea Palace''s kitchen', 90.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_Roti.JPG?width=480', TRUE),
    ('roti-breads', 'Cheese Garlic Naan', 'Roti & Breads special from Hotel Sea Palace''s kitchen', 120.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_Roti.JPG?width=480', TRUE),
    ('rice-khichadi', 'Steam Rice', 'Rice & Khichadi special from Hotel Sea Palace''s kitchen', 150.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Fried_Rice.JPG?width=480', TRUE),
    ('rice-khichadi', 'Steam Rice (Half)', 'Rice & Khichadi special from Hotel Sea Palace''s kitchen', 80.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Fried_Rice.JPG?width=480', TRUE),
    ('rice-khichadi', 'Jeera Rice', 'Rice & Khichadi special from Hotel Sea Palace''s kitchen', 160.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Fried_Rice.JPG?width=480', TRUE),
    ('rice-khichadi', 'Masala Rice', 'Rice & Khichadi special from Hotel Sea Palace''s kitchen', 210.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Fried_Rice.JPG?width=480', TRUE),
    ('rice-khichadi', 'Curd Rice', 'Rice & Khichadi special from Hotel Sea Palace''s kitchen', 180.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Fried_Rice.JPG?width=480', TRUE),
    ('rice-khichadi', 'Palak Khichadi', 'Rice & Khichadi special from Hotel Sea Palace''s kitchen', 180.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Fried_Rice.JPG?width=480', TRUE),
    ('rice-khichadi', 'Dal Khichadi', 'Rice & Khichadi special from Hotel Sea Palace''s kitchen', 190.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Fried_Rice.JPG?width=480', TRUE),
    ('rice-khichadi', 'Dal Tadka Khichadi', 'Rice & Khichadi special from Hotel Sea Palace''s kitchen', 210.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Fried_Rice.JPG?width=480', TRUE),
    ('soup', 'Tomato Soup', 'Soup special from Hotel Sea Palace''s kitchen', 120.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tomato_soup.jpg?width=480', TRUE),
    ('soup', 'Veg Hot ''N'' Sour Soup', 'Soup special from Hotel Sea Palace''s kitchen', 120.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tomato_soup.jpg?width=480', TRUE),
    ('soup', 'Veg Manchow Soup', 'Soup special from Hotel Sea Palace''s kitchen', 120.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tomato_soup.jpg?width=480', TRUE),
    ('soup', 'Veg Sweet Corn Soup', 'Soup special from Hotel Sea Palace''s kitchen', 120.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tomato_soup.jpg?width=480', TRUE),
    ('snacks', 'Paneer Pakoda', 'Snacks special from Hotel Sea Palace''s kitchen', 240.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Pakora.JPG?width=480', TRUE),
    ('snacks', 'Veg Pakoda', 'Snacks special from Hotel Sea Palace''s kitchen', 190.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Pakora.JPG?width=480', TRUE),
    ('snacks', 'Solkadhi', 'Snacks special from Hotel Sea Palace''s kitchen', 60.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Pakora.JPG?width=480', TRUE),
    ('snacks', 'Schezwan Chatani', 'Snacks special from Hotel Sea Palace''s kitchen', 30.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Pakora.JPG?width=480', TRUE),
    ('veg-starters', 'Channa Garlic', 'Veg Starters special from Hotel Sea Palace''s kitchen', 210.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Gobi_manchurian.jpg?width=480', TRUE),
    ('veg-starters', 'Channa Koliwada', 'Veg Starters special from Hotel Sea Palace''s kitchen', 220.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Gobi_manchurian.jpg?width=480', TRUE),
    ('veg-starters', 'Channa Oil Fry', 'Veg Starters special from Hotel Sea Palace''s kitchen', 210.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Gobi_manchurian.jpg?width=480', TRUE),
    ('veg-starters', 'Finger Chips', 'Veg Starters special from Hotel Sea Palace''s kitchen', 140.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Gobi_manchurian.jpg?width=480', TRUE),
    ('veg-starters', 'Green Peas Garlic', 'Veg Starters special from Hotel Sea Palace''s kitchen', 190.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Gobi_manchurian.jpg?width=480', TRUE),
    ('veg-starters', 'Green Peas Oil Fry', 'Veg Starters special from Hotel Sea Palace''s kitchen', 170.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Gobi_manchurian.jpg?width=480', TRUE),
    ('veg-starters', 'Kaju Namkin', 'Veg Starters special from Hotel Sea Palace''s kitchen', 290.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Gobi_manchurian.jpg?width=480', TRUE),
    ('veg-starters', 'Mashroom Chilly', 'Veg Starters special from Hotel Sea Palace''s kitchen', 280.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Gobi_manchurian.jpg?width=480', TRUE),
    ('veg-starters', 'Paneer Chilly Dry / Crispy', 'Veg Starters special from Hotel Sea Palace''s kitchen', 290.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Gobi_manchurian.jpg?width=480', TRUE),
    ('veg-starters', 'Veg Chilly', 'Veg Starters special from Hotel Sea Palace''s kitchen', 280.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Gobi_manchurian.jpg?width=480', TRUE),
    ('veg-starters', 'Veg Crispy', 'Veg Starters special from Hotel Sea Palace''s kitchen', 290.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Gobi_manchurian.jpg?width=480', TRUE),
    ('veg-starters', 'Veg Manchurian Dry', 'Veg Starters special from Hotel Sea Palace''s kitchen', 290.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Gobi_manchurian.jpg?width=480', TRUE),
    ('veg-starters', 'Veg Schezwan Dry', 'Veg Starters special from Hotel Sea Palace''s kitchen', 280.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Gobi_manchurian.jpg?width=480', TRUE),
    ('veg-main-course', 'Aloo Jeera', 'Veg Main Course special from Hotel Sea Palace''s kitchen', 180.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chana_Dal_Curry.jpg?width=480', TRUE),
    ('veg-main-course', 'Aloo Gobi', 'Veg Main Course special from Hotel Sea Palace''s kitchen', 210.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chana_Dal_Curry.jpg?width=480', TRUE),
    ('veg-main-course', 'Aloo Mutter', 'Veg Main Course special from Hotel Sea Palace''s kitchen', 210.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chana_Dal_Curry.jpg?width=480', TRUE),
    ('veg-main-course', 'Aloo Palak', 'Veg Main Course special from Hotel Sea Palace''s kitchen', 210.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chana_Dal_Curry.jpg?width=480', TRUE),
    ('veg-main-course', 'Aloo Shimla', 'Veg Main Course special from Hotel Sea Palace''s kitchen', 210.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chana_Dal_Curry.jpg?width=480', TRUE),
    ('veg-main-course', 'Aloo Tomato', 'Veg Main Course special from Hotel Sea Palace''s kitchen', 210.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chana_Dal_Curry.jpg?width=480', TRUE),
    ('veg-main-course', 'Dal Fry', 'Veg Main Course special from Hotel Sea Palace''s kitchen', 170.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chana_Dal_Curry.jpg?width=480', TRUE),
    ('veg-main-course', 'Chana Masala', 'Veg Main Course special from Hotel Sea Palace''s kitchen', 210.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chana_Dal_Curry.jpg?width=480', TRUE),
    ('veg-main-course', 'Dal Kolhapuri Tadka', 'Veg Main Course special from Hotel Sea Palace''s kitchen', 190.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chana_Dal_Curry.jpg?width=480', TRUE),
    ('veg-main-course', 'Green Peas Masala', 'Veg Main Course special from Hotel Sea Palace''s kitchen', 270.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chana_Dal_Curry.jpg?width=480', TRUE),
    ('veg-main-course', 'Kaju Masala', 'Veg Main Course special from Hotel Sea Palace''s kitchen', 260.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chana_Dal_Curry.jpg?width=480', TRUE),
    ('veg-main-course', 'Mix Veg', 'Veg Main Course special from Hotel Sea Palace''s kitchen', 240.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chana_Dal_Curry.jpg?width=480', TRUE),
    ('veg-main-course', 'Mashroom Cheese Masala', 'Veg Main Course special from Hotel Sea Palace''s kitchen', 310.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chana_Dal_Curry.jpg?width=480', TRUE),
    ('veg-main-course', 'Mashroom Masala', 'Veg Main Course special from Hotel Sea Palace''s kitchen', 280.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chana_Dal_Curry.jpg?width=480', TRUE),
    ('veg-main-course', 'Paneer Handi', 'Veg Main Course special from Hotel Sea Palace''s kitchen', 310.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chana_Dal_Curry.jpg?width=480', TRUE),
    ('veg-main-course', 'Paneer Butter Masala', 'Veg Main Course special from Hotel Sea Palace''s kitchen', 280.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chana_Dal_Curry.jpg?width=480', TRUE),
    ('veg-main-course', 'Paneer Chingari', 'Veg Main Course special from Hotel Sea Palace''s kitchen', 290.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chana_Dal_Curry.jpg?width=480', TRUE),
    ('veg-main-course', 'Paneer Kadai', 'Veg Main Course special from Hotel Sea Palace''s kitchen', 320.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chana_Dal_Curry.jpg?width=480', TRUE),
    ('veg-main-course', 'Paneer Kaju Masala', 'Veg Main Course special from Hotel Sea Palace''s kitchen', 290.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chana_Dal_Curry.jpg?width=480', TRUE),
    ('veg-main-course', 'Paneer Masala', 'Veg Main Course special from Hotel Sea Palace''s kitchen', 260.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chana_Dal_Curry.jpg?width=480', TRUE),
    ('veg-main-course', 'Paneer Mutter', 'Veg Main Course special from Hotel Sea Palace''s kitchen', 260.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chana_Dal_Curry.jpg?width=480', TRUE),
    ('veg-main-course', 'Paneer Palak', 'Veg Main Course special from Hotel Sea Palace''s kitchen', 260.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chana_Dal_Curry.jpg?width=480', TRUE),
    ('veg-main-course', 'Paneer Tikka Masala', 'Veg Main Course special from Hotel Sea Palace''s kitchen', 280.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chana_Dal_Curry.jpg?width=480', TRUE),
    ('veg-main-course', 'Paneer Bhurji', 'Veg Main Course special from Hotel Sea Palace''s kitchen', 280.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chana_Dal_Curry.jpg?width=480', TRUE),
    ('veg-main-course', 'Shimla Masala', 'Veg Main Course special from Hotel Sea Palace''s kitchen', 280.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chana_Dal_Curry.jpg?width=480', TRUE),
    ('veg-main-course', 'Veg Kadhai', 'Veg Main Course special from Hotel Sea Palace''s kitchen', 310.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chana_Dal_Curry.jpg?width=480', TRUE),
    ('veg-main-course', 'Veg Kolhapuri', 'Veg Main Course special from Hotel Sea Palace''s kitchen', 240.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chana_Dal_Curry.jpg?width=480', TRUE),
    ('veg-main-course', 'Veg Lasuni', 'Veg Main Course special from Hotel Sea Palace''s kitchen', 260.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chana_Dal_Curry.jpg?width=480', TRUE),
    ('veg-main-course', 'Veg Makhanwala', 'Veg Main Course special from Hotel Sea Palace''s kitchen', 260.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chana_Dal_Curry.jpg?width=480', TRUE),
    ('veg-main-course', 'Veg Maratha', 'Veg Main Course special from Hotel Sea Palace''s kitchen', 280.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chana_Dal_Curry.jpg?width=480', TRUE),
    ('veg-main-course', 'Mashroom Handi', 'Veg Main Course special from Hotel Sea Palace''s kitchen', 310.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chana_Dal_Curry.jpg?width=480', TRUE),
    ('veg-main-course', 'Mix Veg Handi', 'Veg Main Course special from Hotel Sea Palace''s kitchen', 290.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chana_Dal_Curry.jpg?width=480', TRUE),
    ('veg-chinese', 'Veg Schezwan Fried Rice', 'Veg Chinese special from Hotel Sea Palace''s kitchen', 220.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Manchurian.jpg?width=480', TRUE),
    ('veg-chinese', 'Veg Manchurian Fried Rice', 'Veg Chinese special from Hotel Sea Palace''s kitchen', 280.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Manchurian.jpg?width=480', TRUE),
    ('veg-chinese', 'Veg Triple Rice', 'Veg Chinese special from Hotel Sea Palace''s kitchen', 290.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Manchurian.jpg?width=480', TRUE),
    ('veg-chinese', 'Veg Fried Rice', 'Veg Chinese special from Hotel Sea Palace''s kitchen', 200.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Manchurian.jpg?width=480', TRUE),
    ('veg-chinese', 'Veg Hakka Noodles', 'Veg Chinese special from Hotel Sea Palace''s kitchen', 200.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Manchurian.jpg?width=480', TRUE),
    ('veg-chinese', 'Mashroom Fried Rice', 'Veg Chinese special from Hotel Sea Palace''s kitchen', 210.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Manchurian.jpg?width=480', TRUE),
    ('rice-khichadi', 'Mashroom Biryani', 'Veg Biryani special from Hotel Sea Palace''s kitchen', 260.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Biryani.jpg?width=480', TRUE),
    ('rice-khichadi', 'Mashroom Pulav', 'Veg Biryani special from Hotel Sea Palace''s kitchen', 240.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Biryani.jpg?width=480', TRUE),
    ('rice-khichadi', 'Paneer Biryani', 'Veg Biryani special from Hotel Sea Palace''s kitchen', 290.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Biryani.jpg?width=480', TRUE),
    ('rice-khichadi', 'Paneer Pulav', 'Veg Biryani special from Hotel Sea Palace''s kitchen', 260.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Biryani.jpg?width=480', TRUE),
    ('rice-khichadi', 'Veg Biryani', 'Veg Biryani special from Hotel Sea Palace''s kitchen', 240.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Biryani.jpg?width=480', TRUE),
    ('rice-khichadi', 'Veg Pulav', 'Veg Biryani special from Hotel Sea Palace''s kitchen', 230.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Biryani.jpg?width=480', TRUE),
    ('veg-thali', 'Veg Thali', 'Veg Thali special from Hotel Sea Palace''s kitchen', 170.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Goan_Fish_Thali.jpg?width=480', TRUE),
    ('egg-items', 'Egg Pakoda', 'Egg Items special from Hotel Sea Palace''s kitchen', 210.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chilli_chicken_pakoda.jpg?width=480', FALSE),
    ('egg-items', 'Boil Egg', 'Egg Items special from Hotel Sea Palace''s kitchen', 60.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chilli_chicken_pakoda.jpg?width=480', FALSE),
    ('egg-items', 'Egg Bhurji', 'Egg Items special from Hotel Sea Palace''s kitchen', 120.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chilli_chicken_pakoda.jpg?width=480', FALSE),
    ('egg-items', 'Egg Chilly', 'Egg Items special from Hotel Sea Palace''s kitchen', 220.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chilli_chicken_pakoda.jpg?width=480', FALSE),
    ('egg-items', 'Egg Omlet', 'Egg Items special from Hotel Sea Palace''s kitchen', 90.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chilli_chicken_pakoda.jpg?width=480', FALSE),
    ('egg-items', 'Half Fry', 'Egg Items special from Hotel Sea Palace''s kitchen', 90.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chilli_chicken_pakoda.jpg?width=480', FALSE),
    ('egg-items', 'Egg Fried Rice', 'Egg Items special from Hotel Sea Palace''s kitchen', 200.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chilli_chicken_pakoda.jpg?width=480', FALSE),
    ('egg-items', 'Egg Schezwan Rice', 'Egg Items special from Hotel Sea Palace''s kitchen', 210.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chilli_chicken_pakoda.jpg?width=480', FALSE),
    ('egg-items', 'Egg Triple Rice', 'Egg Items special from Hotel Sea Palace''s kitchen', 280.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chilli_chicken_pakoda.jpg?width=480', FALSE),
    ('egg-items', 'Egg Hakka Noodles', 'Egg Items special from Hotel Sea Palace''s kitchen', 200.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chilli_chicken_pakoda.jpg?width=480', FALSE),
    ('egg-items', 'Egg Schezwan Noodles', 'Egg Items special from Hotel Sea Palace''s kitchen', 220.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chilli_chicken_pakoda.jpg?width=480', FALSE),
    ('egg-items', 'Egg Biryani', 'Egg Items special from Hotel Sea Palace''s kitchen', 250.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chilli_chicken_pakoda.jpg?width=480', FALSE),
    ('egg-items', 'Egg Thali', 'Egg Items special from Hotel Sea Palace''s kitchen', 260.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chilli_chicken_pakoda.jpg?width=480', FALSE),
    ('chicken-starters-tandoori', 'Chicken 65', 'Chicken Starters & Tandoori special from Hotel Sea Palace''s kitchen', 320.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_chicken_Indian.jpg?width=480', FALSE),
    ('chicken-starters-tandoori', 'Chicken Chilly Dry', 'Chicken Starters & Tandoori special from Hotel Sea Palace''s kitchen', 290.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_chicken_Indian.jpg?width=480', FALSE),
    ('chicken-starters-tandoori', 'Chicken Crispy', 'Chicken Starters & Tandoori special from Hotel Sea Palace''s kitchen', 320.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_chicken_Indian.jpg?width=480', FALSE),
    ('chicken-starters-tandoori', 'Chicken Lollipop Masala Dry', 'Chicken Starters & Tandoori special from Hotel Sea Palace''s kitchen', 280.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_chicken_Indian.jpg?width=480', FALSE),
    ('chicken-starters-tandoori', 'Chicken Lollipop', 'Chicken Starters & Tandoori special from Hotel Sea Palace''s kitchen', 260.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_chicken_Indian.jpg?width=480', FALSE),
    ('chicken-starters-tandoori', 'Chicken Manchurian Dry', 'Chicken Starters & Tandoori special from Hotel Sea Palace''s kitchen', 290.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_chicken_Indian.jpg?width=480', FALSE),
    ('chicken-starters-tandoori', 'Chicken Oil Fry', 'Chicken Starters & Tandoori special from Hotel Sea Palace''s kitchen', 290.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_chicken_Indian.jpg?width=480', FALSE),
    ('chicken-starters-tandoori', 'Chicken Schezwan Dry', 'Chicken Starters & Tandoori special from Hotel Sea Palace''s kitchen', 290.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_chicken_Indian.jpg?width=480', FALSE),
    ('chicken-starters-tandoori', 'Chicken Garlic', 'Chicken Starters & Tandoori special from Hotel Sea Palace''s kitchen', 290.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_chicken_Indian.jpg?width=480', FALSE),
    ('chicken-starters-tandoori', 'Chicken Fry', 'Chicken Starters & Tandoori special from Hotel Sea Palace''s kitchen', 290.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_chicken_Indian.jpg?width=480', FALSE),
    ('chicken-starters-tandoori', 'Chicken Tikka', 'Chicken Starters & Tandoori special from Hotel Sea Palace''s kitchen', 310.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_chicken_Indian.jpg?width=480', FALSE),
    ('chicken-starters-tandoori', 'Chicken Tandoori Half', 'Chicken Starters & Tandoori special from Hotel Sea Palace''s kitchen', 260.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_chicken_Indian.jpg?width=480', FALSE),
    ('chicken-starters-tandoori', 'Chicken Tandoori Full', 'Chicken Starters & Tandoori special from Hotel Sea Palace''s kitchen', 430.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_chicken_Indian.jpg?width=480', FALSE),
    ('chicken-starters-tandoori', 'Chicken Pahadi Kabab', 'Chicken Starters & Tandoori special from Hotel Sea Palace''s kitchen', 310.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_chicken_Indian.jpg?width=480', FALSE),
    ('chicken-starters-tandoori', 'Chicken Boti Kabab', 'Chicken Starters & Tandoori special from Hotel Sea Palace''s kitchen', 320.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_chicken_Indian.jpg?width=480', FALSE),
    ('chicken-starters-tandoori', 'Chicken Lollipop Tandoori', 'Chicken Starters & Tandoori special from Hotel Sea Palace''s kitchen', 310.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_chicken_Indian.jpg?width=480', FALSE),
    ('chicken-starters-tandoori', 'Chicken Tangadi Kabab', 'Chicken Starters & Tandoori special from Hotel Sea Palace''s kitchen', 350.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_chicken_Indian.jpg?width=480', FALSE),
    ('chicken-starters-tandoori', 'Chicken Afagan Tandoori (Half)', 'Chicken Starters & Tandoori special from Hotel Sea Palace''s kitchen', 280.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_chicken_Indian.jpg?width=480', FALSE),
    ('chicken-starters-tandoori', 'Chicken Afagan Tandoori (Full)', 'Chicken Starters & Tandoori special from Hotel Sea Palace''s kitchen', 480.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_chicken_Indian.jpg?width=480', FALSE),
    ('chicken-starters-tandoori', 'Chicken Jangali Tandoori (Half)', 'Chicken Starters & Tandoori special from Hotel Sea Palace''s kitchen', 280.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_chicken_Indian.jpg?width=480', FALSE),
    ('chicken-starters-tandoori', 'Chicken Jangali Tandoori (Full)', 'Chicken Starters & Tandoori special from Hotel Sea Palace''s kitchen', 480.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_chicken_Indian.jpg?width=480', FALSE),
    ('chicken-starters-tandoori', 'Rozali Kabab', 'Chicken Starters & Tandoori special from Hotel Sea Palace''s kitchen', 320.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_chicken_Indian.jpg?width=480', FALSE),
    ('chicken-starters-tandoori', 'Chicken Reshmi Kabab', 'Chicken Starters & Tandoori special from Hotel Sea Palace''s kitchen', 320.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_chicken_Indian.jpg?width=480', FALSE),
    ('chicken-starters-tandoori', 'Chicken Lasooni Kabab', 'Chicken Starters & Tandoori special from Hotel Sea Palace''s kitchen', 320.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_chicken_Indian.jpg?width=480', FALSE),
    ('chicken-starters-tandoori', 'Chicken Family Platter', 'Chicken Starters & Tandoori special from Hotel Sea Palace''s kitchen', 1699.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tandoori_chicken_Indian.jpg?width=480', FALSE),
    ('chicken-main-course-biryani', 'Chicken Masala', 'Chicken Main Course & Biryani special from Hotel Sea Palace''s kitchen', 280.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Curry_North_Indian_Style.jpg?width=480', FALSE),
    ('chicken-main-course-biryani', 'Chicken Kolhapuri', 'Chicken Main Course & Biryani special from Hotel Sea Palace''s kitchen', 290.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Curry_North_Indian_Style.jpg?width=480', FALSE),
    ('chicken-main-course-biryani', 'Chicken Tikka Masala', 'Chicken Main Course & Biryani special from Hotel Sea Palace''s kitchen', 340.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Curry_North_Indian_Style.jpg?width=480', FALSE),
    ('chicken-main-course-biryani', 'Chicken Moghlai', 'Chicken Main Course & Biryani special from Hotel Sea Palace''s kitchen', 310.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Curry_North_Indian_Style.jpg?width=480', FALSE),
    ('chicken-main-course-biryani', 'Chicken Hydrabadi', 'Chicken Main Course & Biryani special from Hotel Sea Palace''s kitchen', 290.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Curry_North_Indian_Style.jpg?width=480', FALSE),
    ('chicken-main-course-biryani', 'Chicken Kadhai', 'Chicken Main Course & Biryani special from Hotel Sea Palace''s kitchen', 320.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Curry_North_Indian_Style.jpg?width=480', FALSE),
    ('chicken-main-course-biryani', 'Chicken Lapeta', 'Chicken Main Course & Biryani special from Hotel Sea Palace''s kitchen', 310.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Curry_North_Indian_Style.jpg?width=480', FALSE),
    ('chicken-main-course-biryani', 'Chicken Afagani', 'Chicken Main Course & Biryani special from Hotel Sea Palace''s kitchen', 310.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Curry_North_Indian_Style.jpg?width=480', FALSE),
    ('chicken-main-course-biryani', 'Butter Chicken Full', 'Chicken Main Course & Biryani special from Hotel Sea Palace''s kitchen', 630.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Curry_North_Indian_Style.jpg?width=480', FALSE),
    ('chicken-main-course-biryani', 'Butter Chicken Half', 'Chicken Main Course & Biryani special from Hotel Sea Palace''s kitchen', 350.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Curry_North_Indian_Style.jpg?width=480', FALSE),
    ('chicken-main-course-biryani', 'Chicken Kheema Masala', 'Chicken Main Course & Biryani special from Hotel Sea Palace''s kitchen', 310.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Curry_North_Indian_Style.jpg?width=480', FALSE),
    ('chicken-main-course-biryani', 'Chicken Fried Rice', 'Chicken Main Course & Biryani special from Hotel Sea Palace''s kitchen', 210.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Curry_North_Indian_Style.jpg?width=480', FALSE),
    ('chicken-main-course-biryani', 'Chicken Schezwan Rice', 'Chicken Main Course & Biryani special from Hotel Sea Palace''s kitchen', 230.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Curry_North_Indian_Style.jpg?width=480', FALSE),
    ('chicken-main-course-biryani', 'Chicken Triple Rice', 'Chicken Main Course & Biryani special from Hotel Sea Palace''s kitchen', 290.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Curry_North_Indian_Style.jpg?width=480', FALSE),
    ('chicken-main-course-biryani', 'Chicken Manchurian Rice', 'Chicken Main Course & Biryani special from Hotel Sea Palace''s kitchen', 290.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Curry_North_Indian_Style.jpg?width=480', FALSE),
    ('chicken-main-course-biryani', 'Chicken Hakka Noodles', 'Chicken Main Course & Biryani special from Hotel Sea Palace''s kitchen', 210.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Curry_North_Indian_Style.jpg?width=480', FALSE),
    ('chicken-main-course-biryani', 'Chicken Schezwan Noodles', 'Chicken Main Course & Biryani special from Hotel Sea Palace''s kitchen', 230.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Curry_North_Indian_Style.jpg?width=480', FALSE),
    ('chicken-main-course-biryani', 'Chicken Biryani', 'Chicken Main Course & Biryani special from Hotel Sea Palace''s kitchen', 270.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Curry_North_Indian_Style.jpg?width=480', FALSE),
    ('chicken-main-course-biryani', 'Chicken Pulav', 'Chicken Main Course & Biryani special from Hotel Sea Palace''s kitchen', 260.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Curry_North_Indian_Style.jpg?width=480', FALSE),
    ('chicken-main-course-biryani', 'Chicken Hydrabadi Biryani', 'Chicken Main Course & Biryani special from Hotel Sea Palace''s kitchen', 300.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Curry_North_Indian_Style.jpg?width=480', FALSE),
    ('chicken-thalis', 'Chicken Thali', 'Chicken Thalis special from Hotel Sea Palace''s kitchen', 290.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Goan_Fish_Thali.jpg?width=480', FALSE),
    ('chicken-thalis', 'Chicken Kolhapuri Thali', 'Chicken Thalis special from Hotel Sea Palace''s kitchen', 310.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Goan_Fish_Thali.jpg?width=480', FALSE),
    ('chicken-thalis', 'Chicken Kheema Thali', 'Chicken Thalis special from Hotel Sea Palace''s kitchen', 310.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Goan_Fish_Thali.jpg?width=480', FALSE),
    ('chicken-thalis', 'Butter Chicken Thali', 'Chicken Thalis special from Hotel Sea Palace''s kitchen', 340.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Goan_Fish_Thali.jpg?width=480', FALSE),
    ('chicken-thalis', 'Chicken Kharda Thali', 'Chicken Thalis special from Hotel Sea Palace''s kitchen', 310.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Goan_Fish_Thali.jpg?width=480', FALSE),
    ('chicken-thalis', 'Chicken Kala Masala Thali', 'Chicken Thalis special from Hotel Sea Palace''s kitchen', 310.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Goan_Fish_Thali.jpg?width=480', FALSE),
    ('mutton-liver-items', 'Liver Oil Fry', 'Mutton & Liver Items special from Hotel Sea Palace''s kitchen', 250.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chapati_and_mutton_curry.JPG?width=480', FALSE),
    ('mutton-liver-items', 'Liver Masala', 'Mutton & Liver Items special from Hotel Sea Palace''s kitchen', 240.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chapati_and_mutton_curry.JPG?width=480', FALSE),
    ('mutton-liver-items', 'Chicken Liver Thali', 'Mutton & Liver Items special from Hotel Sea Palace''s kitchen', 260.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chapati_and_mutton_curry.JPG?width=480', FALSE),
    ('mutton-liver-items', 'Mutton Fry', 'Mutton & Liver Items special from Hotel Sea Palace''s kitchen', 410.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chapati_and_mutton_curry.JPG?width=480', FALSE),
    ('mutton-liver-items', 'Mutton Masala', 'Mutton & Liver Items special from Hotel Sea Palace''s kitchen', 390.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chapati_and_mutton_curry.JPG?width=480', FALSE),
    ('mutton-liver-items', 'Mutton Kolhapuri', 'Mutton & Liver Items special from Hotel Sea Palace''s kitchen', 390.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chapati_and_mutton_curry.JPG?width=480', FALSE),
    ('mutton-liver-items', 'Mutton Hydrabadi', 'Mutton & Liver Items special from Hotel Sea Palace''s kitchen', 390.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chapati_and_mutton_curry.JPG?width=480', FALSE),
    ('mutton-liver-items', 'Mutton Lapeta', 'Mutton & Liver Items special from Hotel Sea Palace''s kitchen', 410.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chapati_and_mutton_curry.JPG?width=480', FALSE),
    ('mutton-liver-items', 'Mutton Kheema Masala', 'Mutton & Liver Items special from Hotel Sea Palace''s kitchen', 410.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chapati_and_mutton_curry.JPG?width=480', FALSE),
    ('mutton-liver-items', 'Mutton Biryani', 'Mutton & Liver Items special from Hotel Sea Palace''s kitchen', 370.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chapati_and_mutton_curry.JPG?width=480', FALSE),
    ('mutton-liver-items', 'Mutton Thali', 'Mutton & Liver Items special from Hotel Sea Palace''s kitchen', 370.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chapati_and_mutton_curry.JPG?width=480', FALSE),
    ('mutton-liver-items', 'Mutton Kolhapuri Thali', 'Mutton & Liver Items special from Hotel Sea Palace''s kitchen', 410.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chapati_and_mutton_curry.JPG?width=480', FALSE),
    ('mutton-liver-items', 'Mutton Kheema Thali', 'Mutton & Liver Items special from Hotel Sea Palace''s kitchen', 410.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chapati_and_mutton_curry.JPG?width=480', FALSE),
    ('mutton-liver-items', 'Mutton Kala Masala Thali', 'Mutton & Liver Items special from Hotel Sea Palace''s kitchen', 410.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chapati_and_mutton_curry.JPG?width=480', FALSE),
    ('mutton-liver-items', 'Mutton Kharda Thali', 'Mutton & Liver Items special from Hotel Sea Palace''s kitchen', 410.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chapati_and_mutton_curry.JPG?width=480', FALSE),
    ('fish-seafood', 'Fish Finger', 'Fish & Seafood special from Hotel Sea Palace''s kitchen', 440.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Fry_fish.jpg?width=480', FALSE),
    ('fish-seafood', 'Bombil Fry', 'Fish & Seafood special from Hotel Sea Palace''s kitchen', 290.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Fry_fish.jpg?width=480', FALSE),
    ('fish-seafood', 'Mandeli Fry', 'Fish & Seafood special from Hotel Sea Palace''s kitchen', 210.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Fry_fish.jpg?width=480', FALSE),
    ('fish-seafood', 'Pomfret Tawa / Rawa Fry', 'Fish & Seafood special from Hotel Sea Palace''s kitchen', 510.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Fry_fish.jpg?width=480', FALSE),
    ('fish-seafood', 'Surmai Tawa / Rawa Fry', 'Fish & Seafood special from Hotel Sea Palace''s kitchen', 510.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Fry_fish.jpg?width=480', FALSE),
    ('fish-seafood', 'Bangda Tawa / Rawa Fry', 'Fish & Seafood special from Hotel Sea Palace''s kitchen', 300.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Fry_fish.jpg?width=480', FALSE),
    ('fish-seafood', 'Bangda Masala', 'Fish & Seafood special from Hotel Sea Palace''s kitchen', 320.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Fry_fish.jpg?width=480', FALSE),
    ('fish-seafood', 'Surmai Curry', 'Fish & Seafood special from Hotel Sea Palace''s kitchen', 510.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Fry_fish.jpg?width=480', FALSE),
    ('fish-seafood', 'Surmai Masala', 'Fish & Seafood special from Hotel Sea Palace''s kitchen', 510.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Fry_fish.jpg?width=480', FALSE),
    ('fish-seafood', 'Khekada Masala (Crab)', 'Fish & Seafood special from Hotel Sea Palace''s kitchen', 390.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Fry_fish.jpg?width=480', FALSE),
    ('fish-seafood', 'Prawns Chilly Dry', 'Fish & Seafood special from Hotel Sea Palace''s kitchen', 510.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Fry_fish.jpg?width=480', FALSE),
    ('fish-seafood', 'Prawns Koliwada', 'Fish & Seafood special from Hotel Sea Palace''s kitchen', 510.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Fry_fish.jpg?width=480', FALSE),
    ('fish-seafood', 'Prawns Tawa / Rawa Fry', 'Fish & Seafood special from Hotel Sea Palace''s kitchen', 510.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Fry_fish.jpg?width=480', FALSE),
    ('fish-seafood', 'Prawns Masala', 'Fish & Seafood special from Hotel Sea Palace''s kitchen', 510.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Fry_fish.jpg?width=480', FALSE),
    ('fish-seafood', 'Prawns Fry', 'Fish & Seafood special from Hotel Sea Palace''s kitchen', 510.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Fry_fish.jpg?width=480', FALSE),
    ('fish-seafood', 'Prawns Fried Rice', 'Fish & Seafood special from Hotel Sea Palace''s kitchen', 470.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Fry_fish.jpg?width=480', FALSE),
    ('fish-seafood', 'Prawns Schezwan Rice', 'Fish & Seafood special from Hotel Sea Palace''s kitchen', 460.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Fry_fish.jpg?width=480', FALSE),
    ('fish-seafood', 'Prawns Triple Rice', 'Fish & Seafood special from Hotel Sea Palace''s kitchen', 520.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Fry_fish.jpg?width=480', FALSE),
    ('fish-seafood', 'Prawns Hakka Noodles', 'Fish & Seafood special from Hotel Sea Palace''s kitchen', 450.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Fry_fish.jpg?width=480', FALSE),
    ('fish-seafood', 'Prawns Schezwan Noodles', 'Fish & Seafood special from Hotel Sea Palace''s kitchen', 460.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Fry_fish.jpg?width=480', FALSE),
    ('fish-seafood', 'Prawns Biryani', 'Fish & Seafood special from Hotel Sea Palace''s kitchen', 490.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Fry_fish.jpg?width=480', FALSE),
    ('fish-seafood', 'Prawns Pulav', 'Fish & Seafood special from Hotel Sea Palace''s kitchen', 480.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Fry_fish.jpg?width=480', FALSE),
    ('seafood-thalis', 'Surmai Thali', 'Seafood Thalis special from Hotel Sea Palace''s kitchen', 470.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Goan_Fish_Thali.jpg?width=480', FALSE),
    ('seafood-thalis', 'Pomfret Thali', 'Seafood Thalis special from Hotel Sea Palace''s kitchen', 510.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Goan_Fish_Thali.jpg?width=480', FALSE),
    ('seafood-thalis', 'Prawns Thali', 'Seafood Thalis special from Hotel Sea Palace''s kitchen', 510.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Goan_Fish_Thali.jpg?width=480', FALSE),
    ('seafood-thalis', 'Bangda Thali', 'Seafood Thalis special from Hotel Sea Palace''s kitchen', 320.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Goan_Fish_Thali.jpg?width=480', FALSE),
    ('seafood-thalis', 'Bombil Thali', 'Seafood Thalis special from Hotel Sea Palace''s kitchen', 320.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Goan_Fish_Thali.jpg?width=480', FALSE)
) AS v(slug, name, description, price, image_url, is_veg)
JOIN cat c ON c.slug = v.slug
ON CONFLICT (category_id, name) DO NOTHING;

-- Seed bar menu items (base row per drink; see menu_item_variants below for each pour size)
WITH cat AS (
  SELECT id, slug FROM menu_categories
)
INSERT INTO menu_items (category_id, name, description, price, image_url, is_veg, is_available, preparation_time_minutes)
SELECT c.id, v.name, v.description, v.price, v.image_url, TRUE, TRUE, 5
FROM (
  VALUES
    ('vodka', 'Romanov', 'Vodka - choose your pour size', 80.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/A_bottle_of_Absolut_Vodka.jpg?width=480'),
    ('vodka', 'White Mischief', 'Vodka - choose your pour size', 90.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/A_bottle_of_Absolut_Vodka.jpg?width=480'),
    ('vodka', 'G Master', 'Vodka - choose your pour size', 100.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/A_bottle_of_Absolut_Vodka.jpg?width=480'),
    ('vodka', 'Smirnoff', 'Vodka - choose your pour size', 130.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/A_bottle_of_Absolut_Vodka.jpg?width=480'),
    ('vodka', 'Smirnoff Flavour', 'Vodka - choose your pour size', 140.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/A_bottle_of_Absolut_Vodka.jpg?width=480'),
    ('vodka', 'Magic Moments Flavour', 'Vodka - choose your pour size', 100.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/A_bottle_of_Absolut_Vodka.jpg?width=480'),
    ('vodka', 'Magic Moments', 'Vodka - choose your pour size', 90.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/A_bottle_of_Absolut_Vodka.jpg?width=480'),
    ('scotch', 'Indri', 'Scotch - choose your pour size', 400.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/The_Glenlivet_12_year_old_whisky.jpg?width=480'),
    ('scotch', 'Vat 69', 'Scotch - choose your pour size', 200.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/The_Glenlivet_12_year_old_whisky.jpg?width=480'),
    ('scotch', 'Black & White', 'Scotch - choose your pour size', 200.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/The_Glenlivet_12_year_old_whisky.jpg?width=480'),
    ('scotch', 'Jameson', 'Scotch - choose your pour size', 200.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/The_Glenlivet_12_year_old_whisky.jpg?width=480'),
    ('scotch', 'Red Label', 'Scotch - choose your pour size', 190.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/The_Glenlivet_12_year_old_whisky.jpg?width=480'),
    ('scotch', 'Black Label', 'Scotch - choose your pour size', 270.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/The_Glenlivet_12_year_old_whisky.jpg?width=480'),
    ('scotch', 'Ballantine''s', 'Scotch - choose your pour size', 180.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/The_Glenlivet_12_year_old_whisky.jpg?width=480'),
    ('scotch', 'J&B', 'Scotch - choose your pour size', 180.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/The_Glenlivet_12_year_old_whisky.jpg?width=480'),
    ('scotch', '100 Pipers', 'Scotch - choose your pour size', 180.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/The_Glenlivet_12_year_old_whisky.jpg?width=480'),
    ('premium-whiskey', 'Blenders Pride', 'Premium Whiskey - choose your pour size', 120.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Glass_of_whisky_at_Kotka_City_Theatre.jpg?width=480'),
    ('premium-whiskey', 'American Pride', 'Premium Whiskey - choose your pour size', 120.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Glass_of_whisky_at_Kotka_City_Theatre.jpg?width=480'),
    ('premium-whiskey', 'Antiquity', 'Premium Whiskey - choose your pour size', 110.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Glass_of_whisky_at_Kotka_City_Theatre.jpg?width=480'),
    ('premium-whiskey', 'Signature', 'Premium Whiskey - choose your pour size', 110.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Glass_of_whisky_at_Kotka_City_Theatre.jpg?width=480'),
    ('premium-whiskey', 'Legacy', 'Premium Whiskey - choose your pour size', 110.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Glass_of_whisky_at_Kotka_City_Theatre.jpg?width=480'),
    ('premium-whiskey', 'Rockford', 'Premium Whiskey - choose your pour size', 110.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Glass_of_whisky_at_Kotka_City_Theatre.jpg?width=480'),
    ('premium-whiskey', 'Oaksmith Silver', 'Premium Whiskey - choose your pour size', 90.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Glass_of_whisky_at_Kotka_City_Theatre.jpg?width=480'),
    ('premium-whiskey', 'Oaksmith Gold', 'Premium Whiskey - choose your pour size', 120.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Glass_of_whisky_at_Kotka_City_Theatre.jpg?width=480'),
    ('whiskey', 'Imperial Blue', 'Whiskey - choose your pour size', 80.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Glass_of_whisky_at_Kotka_City_Theatre.jpg?width=480'),
    ('whiskey', 'DSP Black', 'Whiskey - choose your pour size', 80.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Glass_of_whisky_at_Kotka_City_Theatre.jpg?width=480'),
    ('whiskey', 'McDowell''s No.1', 'Whiskey - choose your pour size', 80.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Glass_of_whisky_at_Kotka_City_Theatre.jpg?width=480'),
    ('whiskey', 'Royal Stag Barrel', 'Whiskey - choose your pour size', 100.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Glass_of_whisky_at_Kotka_City_Theatre.jpg?width=480'),
    ('whiskey', 'Royal Stag', 'Whiskey - choose your pour size', 90.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Glass_of_whisky_at_Kotka_City_Theatre.jpg?width=480'),
    ('whiskey', 'Royal Challenge', 'Whiskey - choose your pour size', 90.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Glass_of_whisky_at_Kotka_City_Theatre.jpg?width=480'),
    ('whiskey', 'OCB', 'Whiskey - choose your pour size', 80.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Glass_of_whisky_at_Kotka_City_Theatre.jpg?width=480'),
    ('whiskey', 'The Glenwalk', 'Whiskey - choose your pour size', 120.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Glass_of_whisky_at_Kotka_City_Theatre.jpg?width=480'),
    ('whiskey', 'Iconic', 'Whiskey - choose your pour size', 80.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Glass_of_whisky_at_Kotka_City_Theatre.jpg?width=480'),
    ('whiskey', 'B7', 'Whiskey - choose your pour size', 80.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Glass_of_whisky_at_Kotka_City_Theatre.jpg?width=480'),
    ('whiskey', 'B10', 'Whiskey - choose your pour size', 90.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Glass_of_whisky_at_Kotka_City_Theatre.jpg?width=480'),
    ('rum', 'Old Monk', 'Rum - choose your pour size', 70.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Mc_Dowell_No._1_Rum.jpg?width=480'),
    ('rum', 'McDowell''s No.1 Rum', 'Rum - choose your pour size', 70.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Mc_Dowell_No._1_Rum.jpg?width=480'),
    ('rum', 'Bacardi Black', 'Rum - choose your pour size', 90.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Mc_Dowell_No._1_Rum.jpg?width=480'),
    ('rum', 'Bacardi White', 'Rum - choose your pour size', 130.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Mc_Dowell_No._1_Rum.jpg?width=480'),
    ('rum', 'Bacardi Lemon', 'Rum - choose your pour size', 140.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Mc_Dowell_No._1_Rum.jpg?width=480'),
    ('beer--mild', 'Kingfisher (Mild)', 'Beer - Mild - choose your pour size', 270.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Mug_of_beer_from_above_(ubt_2005).jpg?width=480'),
    ('beer--mild', 'Tuborg (Mild)', 'Beer - Mild - choose your pour size', 260.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Mug_of_beer_from_above_(ubt_2005).jpg?width=480'),
    ('beer--mild', 'London Pilsner', 'Beer - Mild - choose your pour size', 220.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Mug_of_beer_from_above_(ubt_2005).jpg?width=480'),
    ('beer--mild', 'Carlsberg (Mild)', 'Beer - Mild - choose your pour size', 280.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Mug_of_beer_from_above_(ubt_2005).jpg?width=480'),
    ('beer--mild', 'Budweiser (Mild)', 'Beer - Mild - choose your pour size', 280.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Mug_of_beer_from_above_(ubt_2005).jpg?width=480'),
    ('beer--strong', 'Kingfisher Strong', 'Beer - Strong - choose your pour size', 260.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Drinking_a_beer_outside.jpg?width=480'),
    ('beer--strong', 'Tuborg Strong', 'Beer - Strong - choose your pour size', 260.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Drinking_a_beer_outside.jpg?width=480'),
    ('beer--strong', 'London Pilsner Strong', 'Beer - Strong - choose your pour size', 220.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Drinking_a_beer_outside.jpg?width=480'),
    ('beer--strong', 'Carlsberg Strong', 'Beer - Strong - choose your pour size', 280.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Drinking_a_beer_outside.jpg?width=480'),
    ('beer--strong', 'Budweiser Magnum', 'Beer - Strong - choose your pour size', 280.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Drinking_a_beer_outside.jpg?width=480'),
    ('cold-drinks--others', 'Cold Drink', 'Cold Drinks & Others - choose your pour size', 60.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Bottle_and_glass_of_inca_kola.jpg?width=480'),
    ('cold-drinks--others', 'Soda', 'Cold Drinks & Others - choose your pour size', 25.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Bottle_and_glass_of_inca_kola.jpg?width=480'),
    ('cold-drinks--others', 'Mineral Water', 'Cold Drinks & Others - choose your pour size', 25.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Bottle_and_glass_of_inca_kola.jpg?width=480'),
    ('cold-drinks--others', 'Small Water', 'Cold Drinks & Others - choose your pour size', 15.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Bottle_and_glass_of_inca_kola.jpg?width=480'),
    ('cold-drinks--others', 'Solkadhi', 'Cold Drinks & Others - choose your pour size', 50.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Bottle_and_glass_of_inca_kola.jpg?width=480'),
    ('cold-drinks--others', 'Buttermilk', 'Cold Drinks & Others - choose your pour size', 60.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Bottle_and_glass_of_inca_kola.jpg?width=480'),
    ('cold-drinks--others', 'Red Bull', 'Cold Drinks & Others - choose your pour size', 220.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Bottle_and_glass_of_inca_kola.jpg?width=480'),
    ('cold-drinks--others', 'Breezer', 'Cold Drinks & Others - choose your pour size', 260.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Bottle_and_glass_of_inca_kola.jpg?width=480'),
    ('cold-drinks--others', 'Rio', 'Cold Drinks & Others - choose your pour size', 90.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Bottle_and_glass_of_inca_kola.jpg?width=480')
) AS v(slug, name, description, price, image_url)
JOIN cat c ON c.slug = v.slug
ON CONFLICT (category_id, name) DO NOTHING;

-- Seed pour-size variants for every bar item (label + price shown to the guest)
-- Joined through menu_categories.menu_type = 'bar' to avoid name clashes with
-- any food item that happens to share a name (e.g. 'Solkadhi' exists as both a
-- Snacks starter and a bar mocktail).
INSERT INTO menu_item_variants (menu_item_id, label, price, display_order)
SELECT mi.id, v.label, v.price, v.display_order
FROM menu_items mi
JOIN menu_categories mc ON mc.id = mi.category_id AND mc.menu_type = 'bar'
JOIN (
  VALUES
  ('Romanov', '30 ml', 80.00, 1),
  ('Romanov', '60 ml', 130.00, 2),
  ('Romanov', '90 ml', 190.00, 3),
  ('Romanov', '180 ml', 360.00, 4),
  ('White Mischief', '30 ml', 90.00, 1),
  ('White Mischief', '60 ml', 150.00, 2),
  ('White Mischief', '90 ml', 220.00, 3),
  ('White Mischief', '180 ml', 420.00, 4),
  ('G Master', '30 ml', 100.00, 1),
  ('G Master', '60 ml', 160.00, 2),
  ('G Master', '90 ml', 230.00, 3),
  ('G Master', '180 ml', 440.00, 4),
  ('Smirnoff', '30 ml', 130.00, 1),
  ('Smirnoff', '60 ml', 230.00, 2),
  ('Smirnoff', '90 ml', 330.00, 3),
  ('Smirnoff', '180 ml', 610.00, 4),
  ('Smirnoff Flavour', '30 ml', 140.00, 1),
  ('Smirnoff Flavour', '60 ml', 240.00, 2),
  ('Smirnoff Flavour', '90 ml', 350.00, 3),
  ('Smirnoff Flavour', '180 ml', 640.00, 4),
  ('Magic Moments Flavour', '30 ml', 100.00, 1),
  ('Magic Moments Flavour', '60 ml', 160.00, 2),
  ('Magic Moments Flavour', '90 ml', 240.00, 3),
  ('Magic Moments Flavour', '180 ml', 450.00, 4),
  ('Magic Moments', '30 ml', 90.00, 1),
  ('Magic Moments', '60 ml', 150.00, 2),
  ('Magic Moments', '90 ml', 220.00, 3),
  ('Magic Moments', '180 ml', 420.00, 4),
  ('Indri', '30 ml', 400.00, 1),
  ('Indri', '60 ml', 700.00, 2),
  ('Indri', '90 ml', 1050.00, 3),
  ('Indri', '180 ml', 1900.00, 4),
  ('Vat 69', '30 ml', 200.00, 1),
  ('Vat 69', '60 ml', 350.00, 2),
  ('Vat 69', '90 ml', 510.00, 3),
  ('Vat 69', '180 ml', 980.00, 4),
  ('Black & White', '30 ml', 200.00, 1),
  ('Black & White', '60 ml', 380.00, 2),
  ('Black & White', '90 ml', 550.00, 3),
  ('Black & White', '180 ml', 990.00, 4),
  ('Jameson', '30 ml', 200.00, 1),
  ('Jameson', '60 ml', 380.00, 2),
  ('Jameson', '90 ml', 550.00, 3),
  ('Jameson', '180 ml', 1050.00, 4),
  ('Red Label', '30 ml', 190.00, 1),
  ('Red Label', '60 ml', 350.00, 2),
  ('Red Label', '90 ml', 510.00, 3),
  ('Red Label', '180 ml', 980.00, 4),
  ('Black Label', '30 ml', 270.00, 1),
  ('Black Label', '60 ml', 530.00, 2),
  ('Black Label', '90 ml', 790.00, 3),
  ('Black Label', '180 ml', 1540.00, 4),
  ('Ballantine''s', '30 ml', 180.00, 1),
  ('Ballantine''s', '60 ml', 350.00, 2),
  ('Ballantine''s', '90 ml', 480.00, 3),
  ('Ballantine''s', '180 ml', 950.00, 4),
  ('J&B', '30 ml', 180.00, 1),
  ('J&B', '60 ml', 350.00, 2),
  ('J&B', '90 ml', 480.00, 3),
  ('J&B', '180 ml', 950.00, 4),
  ('100 Pipers', '30 ml', 180.00, 1),
  ('100 Pipers', '60 ml', 350.00, 2),
  ('100 Pipers', '90 ml', 520.00, 3),
  ('100 Pipers', '180 ml', 1010.00, 4),
  ('Blenders Pride', '30 ml', 120.00, 1),
  ('Blenders Pride', '60 ml', 210.00, 2),
  ('Blenders Pride', '90 ml', 310.00, 3),
  ('Blenders Pride', '180 ml', 590.00, 4),
  ('American Pride', '30 ml', 120.00, 1),
  ('American Pride', '60 ml', 210.00, 2),
  ('American Pride', '90 ml', 310.00, 3),
  ('American Pride', '180 ml', 590.00, 4),
  ('Antiquity', '30 ml', 110.00, 1),
  ('Antiquity', '60 ml', 230.00, 2),
  ('Antiquity', '90 ml', 340.00, 3),
  ('Antiquity', '180 ml', 620.00, 4),
  ('Signature', '30 ml', 110.00, 1),
  ('Signature', '60 ml', 210.00, 2),
  ('Signature', '90 ml', 310.00, 3),
  ('Signature', '180 ml', 580.00, 4),
  ('Legacy', '30 ml', 110.00, 1),
  ('Legacy', '60 ml', 210.00, 2),
  ('Legacy', '90 ml', 310.00, 3),
  ('Legacy', '180 ml', 590.00, 4),
  ('Rockford', '30 ml', 110.00, 1),
  ('Rockford', '60 ml', 210.00, 2),
  ('Rockford', '90 ml', 310.00, 3),
  ('Rockford', '180 ml', 590.00, 4),
  ('Oaksmith Silver', '30 ml', 90.00, 1),
  ('Oaksmith Silver', '60 ml', 170.00, 2),
  ('Oaksmith Silver', '90 ml', 250.00, 3),
  ('Oaksmith Silver', '180 ml', 480.00, 4),
  ('Oaksmith Gold', '30 ml', 120.00, 1),
  ('Oaksmith Gold', '60 ml', 210.00, 2),
  ('Oaksmith Gold', '90 ml', 310.00, 3),
  ('Oaksmith Gold', '180 ml', 600.00, 4),
  ('Imperial Blue', '30 ml', 80.00, 1),
  ('Imperial Blue', '60 ml', 130.00, 2),
  ('Imperial Blue', '90 ml', 190.00, 3),
  ('Imperial Blue', '180 ml', 360.00, 4),
  ('DSP Black', '30 ml', 80.00, 1),
  ('DSP Black', '60 ml', 130.00, 2),
  ('DSP Black', '90 ml', 190.00, 3),
  ('DSP Black', '180 ml', 360.00, 4),
  ('McDowell''s No.1', '30 ml', 80.00, 1),
  ('McDowell''s No.1', '60 ml', 130.00, 2),
  ('McDowell''s No.1', '90 ml', 190.00, 3),
  ('McDowell''s No.1', '180 ml', 360.00, 4),
  ('Royal Stag Barrel', '30 ml', 100.00, 1),
  ('Royal Stag Barrel', '60 ml', 170.00, 2),
  ('Royal Stag Barrel', '90 ml', 240.00, 3),
  ('Royal Stag Barrel', '180 ml', 440.00, 4),
  ('Royal Stag', '30 ml', 90.00, 1),
  ('Royal Stag', '60 ml', 140.00, 2),
  ('Royal Stag', '90 ml', 210.00, 3),
  ('Royal Stag', '180 ml', 380.00, 4),
  ('Royal Challenge', '30 ml', 90.00, 1),
  ('Royal Challenge', '60 ml', 140.00, 2),
  ('Royal Challenge', '90 ml', 210.00, 3),
  ('Royal Challenge', '180 ml', 390.00, 4),
  ('OCB', '30 ml', 80.00, 1),
  ('OCB', '60 ml', 130.00, 2),
  ('OCB', '90 ml', 190.00, 3),
  ('OCB', '180 ml', 360.00, 4),
  ('The Glenwalk', '30 ml', 120.00, 1),
  ('The Glenwalk', '60 ml', 190.00, 2),
  ('The Glenwalk', '90 ml', 260.00, 3),
  ('The Glenwalk', '180 ml', 460.00, 4),
  ('Iconic', '30 ml', 80.00, 1),
  ('Iconic', '60 ml', 130.00, 2),
  ('Iconic', '90 ml', 190.00, 3),
  ('Iconic', '180 ml', 360.00, 4),
  ('B7', '30 ml', 80.00, 1),
  ('B7', '60 ml', 130.00, 2),
  ('B7', '90 ml', 190.00, 3),
  ('B7', '180 ml', 360.00, 4),
  ('B10', '30 ml', 90.00, 1),
  ('B10', '60 ml', 140.00, 2),
  ('B10', '90 ml', 210.00, 3),
  ('B10', '180 ml', 390.00, 4),
  ('Old Monk', '30 ml', 70.00, 1),
  ('Old Monk', '60 ml', 130.00, 2),
  ('Old Monk', '90 ml', 190.00, 3),
  ('Old Monk', '180 ml', 360.00, 4),
  ('McDowell''s No.1 Rum', '30 ml', 70.00, 1),
  ('McDowell''s No.1 Rum', '60 ml', 130.00, 2),
  ('McDowell''s No.1 Rum', '90 ml', 190.00, 3),
  ('McDowell''s No.1 Rum', '180 ml', 360.00, 4),
  ('Bacardi Black', '30 ml', 90.00, 1),
  ('Bacardi Black', '60 ml', 140.00, 2),
  ('Bacardi Black', '90 ml', 210.00, 3),
  ('Bacardi Black', '180 ml', 390.00, 4),
  ('Bacardi White', '30 ml', 130.00, 1),
  ('Bacardi White', '60 ml', 220.00, 2),
  ('Bacardi White', '90 ml', 330.00, 3),
  ('Bacardi White', '180 ml', 610.00, 4),
  ('Bacardi Lemon', '30 ml', 140.00, 1),
  ('Bacardi Lemon', '60 ml', 240.00, 2),
  ('Bacardi Lemon', '90 ml', 350.00, 3),
  ('Bacardi Lemon', '180 ml', 640.00, 4),
  ('Kingfisher (Mild)', '500 ml', 270.00, 1),
  ('Kingfisher (Mild)', '650 ml', 330.00, 2),
  ('Tuborg (Mild)', '500 ml', 260.00, 1),
  ('Tuborg (Mild)', '650 ml', 310.00, 2),
  ('London Pilsner', '500 ml', 220.00, 1),
  ('London Pilsner', '650 ml', 270.00, 2),
  ('Carlsberg (Mild)', '500 ml', 280.00, 1),
  ('Carlsberg (Mild)', '650 ml', 370.00, 2),
  ('Budweiser (Mild)', '500 ml', 280.00, 1),
  ('Budweiser (Mild)', '650 ml', 370.00, 2),
  ('Kingfisher Strong', '500 ml', 260.00, 1),
  ('Kingfisher Strong', '650 ml', 310.00, 2),
  ('Tuborg Strong', '500 ml', 260.00, 1),
  ('Tuborg Strong', '650 ml', 320.00, 2),
  ('London Pilsner Strong', '500 ml', 220.00, 1),
  ('London Pilsner Strong', '650 ml', 270.00, 2),
  ('Carlsberg Strong', '500 ml', 280.00, 1),
  ('Carlsberg Strong', '650 ml', 390.00, 2),
  ('Budweiser Magnum', '500 ml', 280.00, 1),
  ('Budweiser Magnum', '650 ml', 390.00, 2),
  ('Cold Drink', '600 ml', 60.00, 1),
  ('Soda', '600 ml', 25.00, 1),
  ('Mineral Water', 'Bottle', 25.00, 1),
  ('Small Water', 'Bottle', 15.00, 1),
  ('Solkadhi', 'Glass', 50.00, 1),
  ('Buttermilk', 'Glass', 60.00, 1),
  ('Red Bull', 'Can', 220.00, 1),
  ('Breezer', 'Bottle', 260.00, 1),
  ('Rio', 'Bottle', 90.00, 1)
) AS v(item_name, label, price, display_order) ON v.item_name = mi.name
ON CONFLICT (menu_item_id, label) DO NOTHING;

-- Mark which menu items are alcoholic (drives CGST+SGST vs VAT at order
-- time). Driven purely by category, never by menu_type, since the Bar menu
-- also contains non-alcoholic items (Cold Drinks & Others). Written as two
-- unconditional UPDATEs rather than only-on-insert so re-running db:init
-- always leaves the flag correct even if a manager later moves an item
-- between categories.
UPDATE menu_items mi
SET is_alcoholic = TRUE
FROM menu_categories mc
WHERE mc.id = mi.category_id
  AND mc.slug IN ('vodka', 'scotch', 'premium-whiskey', 'whiskey', 'rum', 'beer--mild', 'beer--strong')
  AND mi.is_alcoholic IS DISTINCT FROM TRUE;

UPDATE menu_items mi
SET is_alcoholic = FALSE
FROM menu_categories mc
WHERE mc.id = mi.category_id
  AND mc.slug NOT IN ('vodka', 'scotch', 'premium-whiskey', 'whiskey', 'rum', 'beer--mild', 'beer--strong')
  AND mi.is_alcoholic IS DISTINCT FROM FALSE;

-- 'Cold Drinks & Others' is mostly non-alcoholic (water, soda, buttermilk,
-- Red Bull...), but "Breezer" and "Rio" are real RTD alcoholic beverage
-- brands (a Bacardi Breezer alcopop and a Skyy Rio alcoholic fruit drink)
-- that happen to be shelved in that same category on the physical menu.
-- Category alone would mis-tag them as non-alcoholic, so they're corrected
-- here by name within that one category.
UPDATE menu_items mi
SET is_alcoholic = TRUE
FROM menu_categories mc
WHERE mc.id = mi.category_id
  AND mc.slug = 'cold-drinks--others'
  AND mi.name IN ('Breezer', 'Rio')
  AND mi.is_alcoholic IS DISTINCT FROM TRUE;

-- Seed today's specials
INSERT INTO todays_specials (menu_item_id, discount_percent, is_featured)
SELECT id, 10.00, TRUE
FROM menu_items
WHERE name IN ('Chicken Family Platter', 'Pomfret Tawa / Rawa Fry', 'Mutton Kolhapuri', 'Chicken Biryani')
ON CONFLICT (menu_item_id) DO NOTHING;

-- Seed restaurant settings
INSERT INTO restaurant_settings (key, value, description)
VALUES
  ('restaurant_name', 'Hotel Sea Palace', 'The restaurant display name'),
  ('currency', 'INR', 'Default currency'),
  ('cgst_rate', '9', 'CGST percent applied to non-alcoholic subtotal'),
  ('sgst_rate', '9', 'SGST percent applied to non-alcoholic subtotal'),
  ('vat_rate', '10', 'VAT percent applied to alcoholic subtotal'),
  ('service_charge', '0', 'Service charge percentage')
ON CONFLICT (key) DO NOTHING;

-- The old flat 5% GST setting is no longer used anywhere in the app - tax is
-- now computed per-category in orderController.js (CGST 9% + SGST 9% on
-- non-alcoholic, VAT 10% on alcoholic). Remove it so it can't be read by
-- mistake; safe to re-run.
DELETE FROM restaurant_settings WHERE key = 'tax_rate';
