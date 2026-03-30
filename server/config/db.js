const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'bit_academic_manager',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

pool.on('connect', () => {
  console.log('PostgreSQL connected');
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err.message);
  process.exit(1);
});

/**
 * Run a parameterised query.
 * Usage: db.query('SELECT * FROM users WHERE id = $1', [id])
 */
const query = (text, params) => pool.query(text, params);

/**
 * Grab a client from the pool for multi-statement transactions.
 * Usage:
 *   const client = await db.getClient();
 *   try {
 *     await client.query('BEGIN');
 *     ...
 *     await client.query('COMMIT');
 *   } catch {
 *     await client.query('ROLLBACK');
 *   } finally {
 *     client.release();
 *   }
 */
const getClient = () => pool.connect();

module.exports = { query, getClient };
