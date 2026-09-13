const db = require('./config/db');

async function main() {
  console.log('Altering menu_items table to ensure image_url TEXT column...');
  await db.query(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS image_url TEXT`);
  await db.query(`ALTER TABLE menu_items ALTER COLUMN image_url TYPE TEXT`);
  
  const colRes = await db.query(`
    SELECT column_name, data_type, character_maximum_length 
    FROM information_schema.columns 
    WHERE table_name = 'menu_items' AND column_name = 'image_url'
  `);
  console.log('Updated column in menu_items:');
  console.table(colRes.rows);

  await db.pool.end();
}

main().catch(console.error);
