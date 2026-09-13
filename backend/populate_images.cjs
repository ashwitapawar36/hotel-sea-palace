const fs = require('fs');
const path = require('path');
const db = require('./config/db');

const FILE = path.join(__dirname, 'dish-images.json');

async function exportItems() {
  // Never overwrite URLs you have already entered.
  if (fs.existsSync(FILE)) {
    throw new Error(
      'dish-images.json already exists. Edit that file instead of exporting again.'
    );
  }

  const { rows } = await db.query(`
    SELECT
      mi.id,
      mi.name,
      mc.name AS category,
      mi.image_url AS current_image_url
    FROM menu_items mi
    JOIN menu_categories mc ON mc.id = mi.category_id
    ORDER BY mc.menu_type, mc.display_order, mc.name, mi.name, mi.id
  `);

  const editableItems = rows.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    current_image_url: item.current_image_url,
    image_url: "",
  }));

  fs.writeFileSync(
    FILE,
    JSON.stringify(editableItems, null, 2),
    'utf8'
  );

  console.log(`Created dish-images.json with ${rows.length} items.`);
  console.log('Paste your URLs into the image_url fields.');
}

async function applyImages() {
  if (!fs.existsSync(FILE)) {
    throw new Error('Run the export command first.');
  }

  const items = JSON.parse(fs.readFileSync(FILE, 'utf8'));

  if (!Array.isArray(items)) {
    throw new Error('dish-images.json must contain an array.');
  }

  const changes = [];
  const ids = new Set();

  for (const item of items) {
    // Empty string means leave this database image unchanged.
    if (item.image_url === "") continue;

    if (
      typeof item.id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id)
    ) {
      throw new Error(`Invalid item ID for ${item.name}`);
    }

    if (ids.has(item.id)) {
      throw new Error(`Duplicate entry for ${item.name}`);
    }

    ids.add(item.id);

    // Explicit null means remove this item's existing image.
    if (item.image_url === null) {
      changes.push({ ...item, image_url: null });
      continue;
    }

    if (typeof item.image_url !== 'string') {
      throw new Error(`Invalid image_url for ${item.name}`);
    }

    const url = item.image_url.trim();

    if (!url) continue;

    const isLocalPath = url.startsWith('/') && !url.startsWith('//');
    let isWebUrl = false;

    try {
      const parsed = new URL(url);
      isWebUrl = ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      // Local paths do not need to be complete web URLs.
    }

    if (!isLocalPath && !isWebUrl) {
      throw new Error(`Use an image URL or local image path for ${item.name}`);
    }

    changes.push({ ...item, image_url: url });
  }

  if (!changes.length) {
    console.log('No changes entered. Nothing updated.');
    return;
  }

  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const backup = [];

    for (const item of changes) {
      const { rows } = await client.query(
        `SELECT id, name, image_url
         FROM menu_items
         WHERE id = $1
         FOR UPDATE`,
        [item.id]
      );

      if (!rows[0] || rows[0].name !== item.name) {
        throw new Error(
          `Item missing or renamed: ${item.name}. Check its ID and name.`
        );
      }

      backup.push(rows[0]);
    }

    const backupFile = path.join(
      __dirname,
      `dish-images-backup-${Date.now()}.json`
    );

    fs.writeFileSync(
      backupFile,
      JSON.stringify(backup, null, 2),
      'utf8'
    );

    for (const item of changes) {
      await client.query(
        `UPDATE menu_items
         SET image_url = $1, updated_at = NOW()
         WHERE id = $2`,
        [item.image_url, item.id]
      );
    }

    await client.query('COMMIT');

    console.log(`Updated ${changes.length} item images.`);
    console.log(`Previous values saved in ${path.basename(backupFile)}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    const command = process.argv[2];

    if (command === 'export') {
      await exportItems();
    } else if (command === 'apply') {
      await applyImages();
    } else {
      console.log('Usage:');
      console.log('  node populate_images.cjs export');
      console.log('  node populate_images.cjs apply');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
}

main();