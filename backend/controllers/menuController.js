const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { uploadDir } = require('../config/env');

const FOOD_GROUPS = ['vegetarian', 'non-vegetarian', 'common'];

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function sendError(error, res, next) {
  if (error.status) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
    });
  }

  if (error.code === '23505') {
    return res.status(409).json({
      success: false,
      message:
        'This name, slug, or variant label already exists. Use a unique value.',
    });
  }

  if (error.code === '23503') {
    return res.status(409).json({
      success: false,
      message:
        'This change conflicts with linked records. Check the category, item, or previous orders.',
    });
  }

  if (error.code === '23514' || error.code === '22P02') {
    return res.status(400).json({
      success: false,
      message: 'One or more values are invalid.',
    });
  }

  return next(error);
}

async function transaction(work) {
  let client;

  try {
    client = await db.getClient();
    await client.query('BEGIN');

    const result = await work(client);

    await client.query('COMMIT');
    return result;
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the original error.
      }
    }
    throw error;
  } finally {
    if (client) client.release();
  }
}

function textValue(value, label, maxLength) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.trim().length > maxLength
  ) {
    fail(400, `${label} must contain 1–${maxLength} characters.`);
  }
  return value.trim();
}

function booleanValue(value, label) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  fail(400, `${label} must be true or false.`);
}

function numericValue(value, label, integer = false) {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'boolean' ||
    !['string', 'number'].includes(typeof value) ||
    String(value).trim() === ''
  ) {
    fail(400, `${label} must be a non-negative number.`);
  }

  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number < 0 ||
    (integer && !Number.isInteger(number))
  ) {
    fail(400, `${label} must be a non-negative ${integer ? 'integer' : 'number'}.`);
  }

  return number;
}

function optionalText(value, label) {
  if (value === null || value === '') return null;
  if (typeof value !== 'string') fail(400, `${label} must be text.`);
  return value.trim() || null;
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function categoryValues(body, current = {}) {
  const name =
    body.name === undefined
      ? current.name
      : textValue(body.name, 'Category name', 100);

  const slug = textValue(
    body.slug === undefined || body.slug === ''
      ? current.slug || slugify(name || '')
      : body.slug,
    'Category slug',
    100,
  );

  const menuType = body.menuType ?? current.menu_type ?? 'food';

  if (!['food', 'bar'].includes(menuType)) {
    fail(400, 'Menu type must be food or bar.');
  }

  const foodGroup =
    menuType === 'bar'
      ? null
      : body.foodGroup === undefined
        ? current.food_group
        : body.foodGroup;

  if (menuType === 'food' && !FOOD_GROUPS.includes(foodGroup)) {
    fail(
      400,
      'Choose vegetarian, non-vegetarian, or common for this food category.',
    );
  }

  return {
    name: textValue(name, 'Category name', 100),
    slug,
    menuType,
    foodGroup,
    description:
      body.description === undefined
        ? current.description ?? null
        : optionalText(body.description, 'Description'),
    displayOrder: numericValue(
      body.displayOrder ?? current.display_order ?? 0,
      'Display order',
      true,
    ),
    isActive: booleanValue(
      body.isActive ?? current.is_active ?? true,
      'Active status',
    ),
  };
}

const CATEGORY_COLUMNS = `
  id, name, slug, menu_type, food_group,
  description, display_order, is_active
`;

const ITEM_COLUMNS = `
  mi.id,
  mi.category_id,
  mc.name AS category_name,
  mc.slug AS category_slug,
  mc.menu_type,
  mc.food_group,
  mc.display_order AS category_display_order,
  mc.is_active AS category_is_active,
  mi.name,
  mi.description,
  mi.price,
  mi.image_url,
  mi.is_veg,
  mi.is_available,
  mi.is_alcoholic,
  mi.preparation_time_minutes,
  mi.created_at,
  mi.updated_at,
  EXISTS (
    SELECT 1
    FROM todays_specials ts
    WHERE ts.menu_item_id = mi.id
      AND ts.is_featured = TRUE
      AND ts.starts_at <= NOW()
      AND (ts.ends_at IS NULL OR ts.ends_at >= NOW())
  ) AS is_special,
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', v.id,
          'label', v.label,
          'price', v.price,
          'display_order', v.display_order
        )
        ORDER BY v.display_order, v.price, v.id
      )
      FROM menu_item_variants v
      WHERE v.menu_item_id = mi.id
    ),
    '[]'::json
  ) AS variants
`;

async function readItem(client, id) {
  const { rows } = await client.query(
    `SELECT ${ITEM_COLUMNS}
     FROM menu_items mi
     JOIN menu_categories mc ON mc.id = mi.category_id
     WHERE mi.id = $1`,
    [id],
  );
  return rows[0];
}

async function listCategories(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT ${CATEGORY_COLUMNS}
       FROM menu_categories
       WHERE is_active = TRUE
       ORDER BY
         menu_type,
         CASE food_group
           WHEN 'vegetarian' THEN 1
           WHEN 'non-vegetarian' THEN 2
           WHEN 'common' THEN 3
           ELSE 4
         END,
         display_order,
         name`,
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    sendError(error, res, next);
  }
}

async function createCategory(req, res, next) {
  try {
    const c = categoryValues(req.body);

    const { rows } = await db.query(
      `INSERT INTO menu_categories (
         name, slug, menu_type, food_group,
         description, display_order, is_active
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${CATEGORY_COLUMNS}`,
      [
        c.name,
        c.slug,
        c.menuType,
        c.foodGroup,
        c.description,
        c.displayOrder,
        c.isActive,
      ],
    );

    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    sendError(error, res, next);
  }
}

async function updateCategory(req, res, next) {
  try {
    const result = await transaction(async (client) => {
      const { rows } = await client.query(
        'SELECT * FROM menu_categories WHERE id = $1 FOR UPDATE',
        [req.params.id],
      );

      if (!rows[0]) fail(404, 'Category not found.');

      const current = rows[0];
      const c = categoryValues(req.body, current);

      // Avoid reclassifying every dish or drink implicitly.
      if (
        c.menuType !== current.menu_type ||
        c.foodGroup !== current.food_group
      ) {
        const { rowCount } = await client.query(
          'SELECT 1 FROM menu_items WHERE category_id = $1 LIMIT 1',
          [req.params.id],
        );

        if (rowCount) {
          fail(
            409,
            'This category contains items. Move them to the correct category before changing its menu type or food group.',
          );
        }
      }

      const updated = await client.query(
        `UPDATE menu_categories
         SET name = $1,
             slug = $2,
             menu_type = $3,
             food_group = $4,
             description = $5,
             display_order = $6,
             is_active = $7,
             updated_at = NOW()
         WHERE id = $8
         RETURNING ${CATEGORY_COLUMNS}`,
        [
          c.name,
          c.slug,
          c.menuType,
          c.foodGroup,
          c.description,
          c.displayOrder,
          c.isActive,
          req.params.id,
        ],
      );

      return updated.rows[0];
    });

    res.json({ success: true, data: result });
  } catch (error) {
    sendError(error, res, next);
  }
}

async function deleteCategory(req, res, next) {
  try {
    await transaction(async (client) => {
      const { rowCount } = await client.query(
        'SELECT id FROM menu_categories WHERE id = $1 FOR UPDATE',
        [req.params.id],
      );

      if (!rowCount) fail(404, 'Category not found.');

      const items = await client.query(
        'SELECT 1 FROM menu_items WHERE category_id = $1 LIMIT 1',
        [req.params.id],
      );

      if (items.rowCount) {
        fail(
          409,
          'This category contains items. Move those items before deleting it.',
        );
      }

      await client.query('DELETE FROM menu_categories WHERE id = $1', [
        req.params.id,
      ]);
    });

    res.json({ success: true, message: 'Category deleted.' });
  } catch (error) {
    sendError(error, res, next);
  }
}

async function listMenuItems(req, res, next) {
  try {
    const type = req.query.type || 'food';
    const foodGroup = req.query.foodGroup || null;
    const includeUnavailable =
      req.query.all === 'true' && Boolean(req.manager);

    if (!['food', 'bar', 'all'].includes(type)) {
      fail(400, 'Type must be food, bar, or all.');
    }

    if (foodGroup !== null && !FOOD_GROUPS.includes(foodGroup)) {
      fail(400, 'Invalid food group.');
    }

    const { rows } = await db.query(
      `SELECT ${ITEM_COLUMNS}
       FROM menu_items mi
       JOIN menu_categories mc ON mc.id = mi.category_id
       WHERE ($1 = 'all' OR mc.menu_type = $1)
         AND ($2::boolean OR (mi.is_available AND mc.is_active))
         AND ($3::text IS NULL OR mc.food_group = $3)
       ORDER BY
         mc.menu_type,
         CASE mc.food_group
           WHEN 'vegetarian' THEN 1
           WHEN 'non-vegetarian' THEN 2
           WHEN 'common' THEN 3
           ELSE 4
         END,
         mc.display_order,
         mc.name,
         mi.name,
         mi.id`,
      [type, includeUnavailable, foodGroup],
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    sendError(error, res, next);
  }
}

async function listPopularItems(req, res, next) {
  try {
    const requestedLimit =
      req.query.limit === undefined ? 6 : Number(req.query.limit);

    if (!Number.isInteger(requestedLimit) || requestedLimit < 1) {
      fail(400, 'Limit must be a positive integer.');
    }

    const { rows } = await db.query(
      `SELECT ${ITEM_COLUMNS},
              sold.total_quantity
       FROM menu_items mi
       JOIN menu_categories mc ON mc.id = mi.category_id
       JOIN (
         SELECT oi.menu_item_id, SUM(oi.quantity) AS total_quantity
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE o.status <> 'cancelled'
         GROUP BY oi.menu_item_id
       ) sold ON sold.menu_item_id = mi.id
       WHERE mi.is_available = TRUE
         AND mc.is_active = TRUE
         AND mc.menu_type = 'food'
       ORDER BY sold.total_quantity DESC, mi.name, mi.id
       LIMIT $1`,
      [Math.min(requestedLimit, 20)],
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    sendError(error, res, next);
  }
}

async function validateItemCategory(client, item, requestedType) {
  const { rows } = await client.query(
    'SELECT * FROM menu_categories WHERE id = $1 FOR SHARE',
    [item.category_id],
  );

  const category = rows[0];

  if (!category) fail(400, 'Selected category does not exist.');

  if (requestedType && requestedType !== category.menu_type) {
    fail(400, 'The selected category does not match the menu type.');
  }

  if (
    category.menu_type === 'food' &&
    !FOOD_GROUPS.includes(category.food_group)
  ) {
    fail(400, 'Assign a food group to this category first.');
  }

  if (category.food_group === 'vegetarian' && !item.is_veg) {
    fail(400, 'A non-vegetarian dish cannot use a Veg category.');
  }

  if (category.food_group === 'non-vegetarian' && item.is_veg) {
    fail(400, 'A vegetarian dish cannot use a Non-Veg category.');
  }

  if (category.menu_type === 'food' && item.is_alcoholic) {
    fail(400, 'Alcoholic items must use a Bar category.');
  }
}

function itemValues(body, current = {}) {
  const item = {
    category_id: body.categoryId ?? current.category_id,
    name:
      body.name === undefined
        ? current.name
        : textValue(body.name, 'Item name', 150),
    description:
      body.description === undefined
        ? current.description ?? null
        : optionalText(body.description, 'Description'),
    price: numericValue(body.price ?? current.price, 'Price'),
    image_url:
      body.imageUrl === undefined
        ? current.image_url ?? null
        : optionalText(body.imageUrl, 'Image URL'),
    is_veg: booleanValue(
      body.isVeg ?? current.is_veg ?? true,
      'Vegetarian status',
    ),
    is_available: booleanValue(
      body.isAvailable ?? current.is_available ?? true,
      'Availability',
    ),
    is_alcoholic: booleanValue(
      body.isAlcoholic ?? current.is_alcoholic ?? false,
      'Alcoholic status',
    ),
    preparation_time_minutes: numericValue(
      body.preparationTimeMinutes ??
        current.preparation_time_minutes ??
        15,
      'Preparation time',
      true,
    ),
  };

  item.name = textValue(item.name, 'Item name', 150);

  if (!item.category_id) fail(400, 'Category is required.');

  return item;
}

// "variants" is the complete desired set when supplied.
// Omit it to leave existing variants unchanged.
//
// Match by ID first, then by unchanged label for older clients.
// Used variants cannot be removed or renamed because invoices
// resolve their labels through the variant reference.
async function saveVariants(client, itemId, variants) {
  if (!Array.isArray(variants)) fail(400, 'Variants must be an array.');

  const { rows: existing } = await client.query(
    `SELECT id, label, price, display_order
     FROM menu_item_variants
     WHERE menu_item_id = $1
     FOR UPDATE`,
    [itemId],
  );

  const desired = [];
  const labels = new Set();
  const retainedIds = new Set();

  for (let index = 0; index < variants.length; index += 1) {
    const variant = variants[index];

    if (!variant || typeof variant !== 'object') {
      fail(400, 'Each variant must be an object.');
    }

    const label = textValue(variant.label, 'Variant label', 50);
    const price = numericValue(variant.price, 'Variant price');
    const displayOrder = numericValue(
      variant.displayOrder ?? variant.display_order ?? index,
      'Variant display order',
      true,
    );

    if (labels.has(label.toLowerCase())) {
      fail(400, 'Variant labels must be unique.');
    }
    labels.add(label.toLowerCase());

    let match;

    if (variant.id !== undefined && variant.id !== null) {
      match = existing.find((v) => v.id === variant.id);
      if (!match) fail(400, 'Variant ID does not belong to this item.');
    } else {
      match = existing.find((v) => v.label === label);
    }

    if (match && retainedIds.has(match.id)) {
      fail(400, 'The same variant was supplied more than once.');
    }

    if (match) {
      retainedIds.add(match.id);

      // Reject label swaps/collisions explicitly.
      if (existing.some((v) => v.id !== match.id && v.label === label)) {
        fail(409, 'That variant label already exists on this item.');
      }

      if (match.label !== label) {
        const used = await client.query(
          'SELECT 1 FROM order_items WHERE variant_id = $1 LIMIT 1',
          [match.id],
        );

        if (used.rowCount) {
          fail(
            409,
            `Cannot rename "${match.label}" because previous orders use it.`,
          );
        }
      }
    }

    desired.push({
      id: match?.id,
      label,
      price,
      displayOrder,
    });
  }

  const removed = existing.filter((v) => !retainedIds.has(v.id));

  for (const variant of removed) {
    const used = await client.query(
      'SELECT 1 FROM order_items WHERE variant_id = $1 LIMIT 1',
      [variant.id],
    );

    if (used.rowCount) {
      fail(
        409,
        `Cannot remove "${variant.label}" because previous orders use it. Keep this variant or mark the item unavailable.`,
      );
    }
  }

  for (const variant of removed) {
    await client.query('DELETE FROM menu_item_variants WHERE id = $1', [
      variant.id,
    ]);
  }

  for (const variant of desired) {
    if (variant.id) {
      await client.query(
        `UPDATE menu_item_variants
         SET label = $1, price = $2, display_order = $3,
             updated_at = NOW()
         WHERE id = $4 AND menu_item_id = $5`,
        [
          variant.label,
          variant.price,
          variant.displayOrder,
          variant.id,
          itemId,
        ],
      );
    } else {
      await client.query(
        `INSERT INTO menu_item_variants (
           menu_item_id, label, price, display_order
         ) VALUES ($1, $2, $3, $4)`,
        [itemId, variant.label, variant.price, variant.displayOrder],
      );
    }
  }
}

async function createMenuItem(req, res, next) {
  try {
    const result = await transaction(async (client) => {
      const item = itemValues(req.body);

      await validateItemCategory(client, item, req.body.type);

      const { rows } = await client.query(
        `INSERT INTO menu_items (
           category_id, name, description, price, image_url,
           is_veg, is_available, is_alcoholic,
           preparation_time_minutes
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          item.category_id,
          item.name,
          item.description,
          item.price,
          item.image_url,
          item.is_veg,
          item.is_available,
          item.is_alcoholic,
          item.preparation_time_minutes,
        ],
      );

      const id = rows[0].id;

      if (req.body.variants !== undefined) {
        await saveVariants(client, id, req.body.variants);
      }

      return readItem(client, id);
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    sendError(error, res, next);
  }
}

async function updateMenuItem(req, res, next) {
  try {
    const supportedFields = [
      'categoryId',
      'name',
      'description',
      'price',
      'imageUrl',
      'isVeg',
      'isAvailable',
      'isAlcoholic',
      'preparationTimeMinutes',
      'variants',
    ];

    if (!supportedFields.some((key) => req.body[key] !== undefined)) {
      fail(400, 'No fields to update.');
    }

    const result = await transaction(async (client) => {
      const { rows } = await client.query(
        'SELECT * FROM menu_items WHERE id = $1 FOR UPDATE',
        [req.params.id],
      );

      if (!rows[0]) fail(404, 'Menu item not found.');

      const item = itemValues(req.body, rows[0]);

      await validateItemCategory(client, item, req.body.type);

      await client.query(
        `UPDATE menu_items
         SET category_id = $1,
             name = $2,
             description = $3,
             price = $4,
             image_url = $5,
             is_veg = $6,
             is_available = $7,
             is_alcoholic = $8,
             preparation_time_minutes = $9,
             updated_at = NOW()
         WHERE id = $10`,
        [
          item.category_id,
          item.name,
          item.description,
          item.price,
          item.image_url,
          item.is_veg,
          item.is_available,
          item.is_alcoholic,
          item.preparation_time_minutes,
          req.params.id,
        ],
      );

      if (req.body.variants !== undefined) {
        await saveVariants(client, req.params.id, req.body.variants);
      }

      return readItem(client, req.params.id);
    });

    res.json({ success: true, data: result });
  } catch (error) {
    sendError(error, res, next);
  }
}

async function toggleSpecial(req, res, next) {
  try {
    const isSpecial = booleanValue(req.body.isSpecial, 'Special status');

    await transaction(async (client) => {
      const { rowCount } = await client.query(
        'SELECT id FROM menu_items WHERE id = $1 FOR UPDATE',
        [req.params.id],
      );

      if (!rowCount) fail(404, 'Menu item not found.');

      if (isSpecial) {
        await client.query(
          `INSERT INTO todays_specials (
             menu_item_id, discount_percent,
             is_featured, starts_at, ends_at
           )
           VALUES ($1, 0, TRUE, NOW(), NULL)
           ON CONFLICT (menu_item_id)
           DO UPDATE SET
             starts_at = NOW(),
             ends_at = NULL,
             is_featured = TRUE,
             updated_at = NOW()`,
          [req.params.id],
        );
      } else {
        await client.query(
          'DELETE FROM todays_specials WHERE menu_item_id = $1',
          [req.params.id],
        );
      }
    });

    res.json({
      success: true,
      data: { id: req.params.id, isSpecial },
    });
  } catch (error) {
    sendError(error, res, next);
  }
}

async function deleteMenuItem(req, res, next) {
  try {
    await transaction(async (client) => {
      const { rowCount } = await client.query(
        'SELECT id FROM menu_items WHERE id = $1 FOR UPDATE',
        [req.params.id],
      );

      if (!rowCount) fail(404, 'Menu item not found.');

      const used = await client.query(
        'SELECT 1 FROM order_items WHERE menu_item_id = $1 LIMIT 1',
        [req.params.id],
      );

      if (used.rowCount) {
        fail(
          409,
          'This item has previous orders. Mark it unavailable instead of deleting it.',
        );
      }

      await client.query('DELETE FROM menu_items WHERE id = $1', [
        req.params.id,
      ]);
    });

    res.json({ success: true, message: 'Menu item deleted.' });
  } catch (error) {
    sendError(error, res, next);
  }
}

async function uploadImage(req, res, next) {
  try {
    if (!req.file) fail(400, 'No file uploaded.');

    const extension = path.extname(req.file.originalname) || '.jpg';
    const filename =
      `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;

    const directory = path.resolve(__dirname, '..', uploadDir);
    await fs.promises.mkdir(directory, { recursive: true });

    await fs.promises.rename(
      req.file.path,
      path.join(directory, filename),
    );

    res.json({
      success: true,
      data: { imageUrl: `/uploads/${filename}` },
    });
  } catch (error) {
    sendError(error, res, next);
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