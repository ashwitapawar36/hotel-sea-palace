const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const { databaseUrl } = require('../config/env');

async function runSqlFile(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  await db.query(sql);
}

async function initializeDatabase() {
  try {
    await runSqlFile(path.join(__dirname, 'schema.sql'));
    await runSqlFile(path.join(__dirname, 'seed.sql'));
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed', error);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
}

initializeDatabase();
