const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { uploadDir } = require('../config/env');

async function listCategories(req, res, next) {
  try {
    const { rows } = await db.query('SELECT id, name, slug, menu_type, food_group, description, display_order, is_active FROM menu_categories WHERE is_active = TRUE ORDER BY display_order ASC, name ASC');
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

async function createCategory(req, res, next) {
  try {
    const { name, slug, menuType = 'food', foodGroup, description, displayOrder = 0, isActive = true } = req.body;
    // Bar has no Vegetarian/Non-Vegetarian split, so food_group only ever
    // gets stored for menu_type='food'.
    const resolvedFoodGroup = menuType === 'food' ? foodGroup || null : null;
    const { rows } = await db.query(
      `INSERT INTO menu_categories (name, slug, menu_type, food_group, description, display_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, slug, menu_type, food_group, description, display_order, is_active, created_at`,
      [name, slug, menuType, resolvedFoodGroup, description || null, displayOrder, isActive],
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
}

async function updateCategory(req, res, next) {
  try {
    const { id } = req.params;
    const { name, slug, menuType, foodGroup, description, displayOrder, isActive } = req.body;
    const fields = [];
    const values = [];
    let index = 1;

    const addField = (column, value) => {
      if (value !== undefined) {
        fields.push(`${column} = $${index}`);
        values.push(value);
        index += 1;
      }
    };

    addField('name', name);
    addField('slug', slug);
    addField('menu_type', menuType);
    // Bar has no Vegetarian/Non-Vegetarian split - switching a category to
    // 'bar' always clears food_group, regardless of what else was sent.
    addField('food_group', menuType === 'bar' ? null : foodGroup);
    addField('description', description);
    addField('display_order', displayOrder);
    addField('is_active', isActive);

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    values.push(id);
    const { rows } = await db.query(`UPDATE menu_categories SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${index} RETURNING id, name, slug, menu_type, food_group, description, display_order, is_active, updated_at`, values);

    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
}

async function deleteCategory(req, res, next) {
  try {
    const { id } = req.params;
    const { rowCount } = await db.query('DELETE FROM menu_categories WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    next(error);
  }
}

async function listMenuItems(req, res, next) {
  try {
    const type = req.query.type || 'food';
    // Public/customer requests only ever see available items. A signed-in
    // manager passing ?all=true also sees unavailable items, so Stock/Menu
    // management can find and re-enable something that's currently hidden.
    const includeUnavailable = req.query.all === 'true' && !!req.manager;
    const { rows } = await db.query(
      `SELECT mi.id, mi.category_id, mc.name AS category_name, mc.menu_type, mc.food_group, mc.display_order AS category_display_order, mi.name, mi.description, mi.price, mi.image_url, mi.is_veg, mi.is_available, mi.is_alcoholic, mi.preparation_time_minutes, mi.created_at,
              EXISTS (SELECT 1 FROM todays_specials ts WHERE ts.menu_item_id = mi.id AND ts.starts_at <= NOW() AND (ts.ends_at IS NULL OR ts.ends_at >= NOW())) AS is_special,
              COALESCE(
                (SELECT json_agg(json_build_object('id', v.id, 'label', v.label, 'price', v.price) ORDER BY v.display_order, v.price)
                 FROM menu_item_variants v WHERE v.menu_item_id = mi.id),
                '[]'::json
              ) AS variants
       FROM menu_items mi
       JOIN menu_categories mc ON mc.id = mi.category_id
       WHERE ($2 = TRUE OR mi.is_available = TRUE) AND mc.is_active = TRUE AND ($1 = 'all' OR mc.menu_type = $1)
       ORDER BY mc.display_order ASC, mi.name ASC`,
      [type, includeUnavailable],
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

// Customer-facing popularity, driven purely by real order history: total
// quantity sold across all non-cancelled orders. Only currently-available
// food items are eligible, so the Home page never links to something a
// guest can't actually order right now.
async function listPopularItems(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit) || 6, 20);
    const { rows } = await db.query(
      `SELECT mi.id, mi.category_id, mc.name AS category_name, mc.menu_type, mi.name, mi.description, mi.price, mi.image_url,
              mi.is_veg, mi.is_available, mi.is_alcoholic, mi.preparation_time_minutes, mi.created_at,
              EXISTS (SELECT 1 FROM todays_specials ts WHERE ts.menu_item_id = mi.id AND ts.starts_at <= NOW() AND (ts.ends_at IS NULL OR ts.ends_at >= NOW())) AS is_special,
              COALESCE(
                (SELECT json_agg(json_build_object('id', v.id, 'label', v.label, 'price', v.price) ORDER BY v.display_order, v.price)
                 FROM menu_item_variants v WHERE v.menu_item_id = mi.id),
                '[]'::json
              ) AS variants,
              COALESCE(sold.total_quantity, 0)::int AS total_quantity
       FROM menu_items mi
       JOIN menu_categories mc ON mc.id = mi.category_id
       JOIN (
         SELECT oi.menu_item_id, SUM(oi.quantity) AS total_quantity
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE o.status != 'cancelled'
         GROUP BY oi.menu_item_id
       ) sold ON sold.menu_item_id = mi.id
       WHERE mi.is_available = TRUE AND mc.is_active = TRUE AND mc.menu_type = 'food'
       ORDER BY sold.total_quantity DESC, mi.name ASC
       LIMIT $1`,
      [limit],
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

async function createMenuItem(req, res, next) {
  const client = await db.getClient();
  try {
    const { categoryId, name, description, price, imageUrl, isVeg = true, isAvailable = true, isAlcoholic = false, preparationTimeMinutes = 15, type, variants } = req.body;

    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO menu_items (category_id, name, description, price, image_url, is_veg, is_available, is_alcoholic, preparation_time_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, category_id, name, description, price, image_url, is_veg, is_available, is_alcoholic, preparation_time_minutes, created_at`,
      [categoryId, name, description || null, price, imageUrl || null, isVeg, isAvailable, isAlcoholic, preparationTimeMinutes],
    );

    const menuItem = rows[0];
    let insertedVariants = [];

    if (Array.isArray(variants) && variants.length > 0) {
      const variantRows = await Promise.all(
        variants.map((v, index) =>
          client.query(
            `INSERT INTO menu_item_variants (menu_item_id, label, price, display_order)
             VALUES ($1, $2, $3, $4)
             RETURNING id, label, price, display_order`,
            [menuItem.id, v.label, v.price, v.displayOrder ?? index],
          ),
        ),
      );
      insertedVariants = variantRows.map((r) => r.rows[0]);
    }

    if (type === 'bar') {
      await client.query('INSERT INTO menu_categories (name, slug, menu_type, description, display_order, is_active) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (slug) DO NOTHING', ['Bar', 'bar', 'bar', 'Bar menu', 99, true]);
    }

    await client.query('COMMIT');

    res.status(201).json({ success: true, data: { ...menuItem, variants: insertedVariants } });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
}

async function updateMenuItem(req, res, next) {
  const client = await db.getClient();
  try {
    const { id } = req.params;
    const { name, description, price, imageUrl, isVeg, isAvailable, isAlcoholic, preparationTimeMinutes, categoryId, variants } = req.body;

    const fields = [];
    const values = [];
    let idx = 1;

    const addField = (column, value) => {
      if (value !== undefined) {
        fields.push(`${column} = $${idx}`);
        values.push(value);
        idx += 1;
      }
    };

    addField('name', name);
    addField('description', description);
    addField('price', price);
    addField('image_url', imageUrl);
    addField('is_veg', isVeg);
    addField('is_available', isAvailable);
    addField('is_alcoholic', isAlcoholic);
    addField('preparation_time_minutes', preparationTimeMinutes);
    addField('category_id', categoryId);

    if (fields.length === 0 && variants === undefined) {
      client.release();
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    await client.query('BEGIN');

    let menuItem;
    if (fields.length > 0) {
      values.push(id);
      const { rows } = await client.query(`UPDATE menu_items SET ${fields.join(', ')} , updated_at = NOW() WHERE id = $${idx} RETURNING id, category_id, name, description, price, image_url, is_veg, is_available, is_alcoholic, preparation_time_minutes, updated_at`, values);
      menuItem = rows[0];
    } else {
      const { rows } = await client.query('SELECT id, category_id, name, description, price, image_url, is_veg, is_available, is_alcoholic, preparation_time_minutes, updated_at FROM menu_items WHERE id = $1', [id]);
      menuItem = rows[0];
    }

    if (!menuItem) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    let updatedVariants;
    if (Array.isArray(variants)) {
      // Replace the full set of pour-size variants for this item.
      await client.query('DELETE FROM menu_item_variants WHERE menu_item_id = $1', [id]);
      const variantRows = await Promise.all(
        variants.map((v, index) =>
          client.query(
            `INSERT INTO menu_item_variants (menu_item_id, label, price, display_order)
             VALUES ($1, $2, $3, $4)
             RETURNING id, label, price, display_order`,
            [id, v.label, v.price, v.displayOrder ?? index],
          ),
        ),
      );
      updatedVariants = variantRows.map((r) => r.rows[0]);
    }

    await client.query('COMMIT');

    res.json({ success: true, data: updatedVariants ? { ...menuItem, variants: updatedVariants } : menuItem });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
}

async function toggleSpecial(req, res, next) {
  try {
    const { id } = req.params;
    const { isSpecial } = req.body;

    const { rows: itemRows } = await db.query('SELECT id FROM menu_items WHERE id = $1', [id]);
    if (!itemRows[0]) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    if (isSpecial) {
      // Re-enabling a special always gives it a fresh active window - if it
      // was previously toggled off (row deleted) or had an old ends_at from
      // a prior run, ON CONFLICT alone wouldn't clear that expiry.
      await db.query(
        `INSERT INTO todays_specials (menu_item_id, discount_percent, is_featured, starts_at, ends_at)
         VALUES ($1, 0, TRUE, NOW(), NULL)
         ON CONFLICT (menu_item_id) DO UPDATE SET starts_at = NOW(), ends_at = NULL, is_featured = TRUE`,
        [id],
      );
    } else {
      await db.query('DELETE FROM todays_specials WHERE menu_item_id = $1', [id]);
    }

    res.json({ success: true, data: { id, isSpecial: !!isSpecial } });
  } catch (error) {
    next(error);
  }
}

async function deleteMenuItem(req, res, next) {
  try {
    const { id } = req.params;
    const { rowCount } = await db.query('DELETE FROM menu_items WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }
    res.json({ success: true, message: 'Menu item deleted' });
  } catch (error) {
    next(error);
  }
}

async function uploadImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const extension = path.extname(req.file.originalname) || '.jpg';
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
    const targetPath = path.join(__dirname, '..', uploadDir, filename);
    fs.renameSync(req.file.path, targetPath);

    const imageUrl = `/uploads/${filename}`;
    res.json({ success: true, data: { imageUrl } });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listMenuItems,
  listPopularItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleSpecial,
  uploadImage,
};
