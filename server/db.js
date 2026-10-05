const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Defina a variável DATABASE_URL (veja o arquivo .env.example).');
  process.exit(1);
}

// URL externa do Render (*.render.com) exige SSL; a interna e a local, não.
// DB_SSL=true/false força um dos dois.
function precisaSsl() {
  if (process.env.DB_SSL) return process.env.DB_SSL === 'true';
  return /\.render\.com/.test(connectionString);
}

const pool = new Pool({
  connectionString,
  ssl: precisaSsl() ? { rejectUnauthorized: false } : false,
});

async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  initDb,
};
