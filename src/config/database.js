const { Pool } = require('pg');
const { db } = require('./env');

const pool = new Pool({
  host: db.host,
  port: db.port,
  user: db.user,
  password: db.password,
  database: db.database,
  ssl: db.ssl ? { rejectUnauthorized: false } : false
});

module.exports = pool;
