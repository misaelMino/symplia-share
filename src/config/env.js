const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

function must(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Falta variable de entorno: ${name}`);
  }
  return String(value).trim();
}

function optional(name, fallback = '') {
  const value = process.env[name];
  return value && String(value).trim() ? String(value).trim() : fallback;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).trim().toLowerCase() === 'true';
}

function parseList(value, fallback = []) {
  if (!value || !String(value).trim()) return fallback;
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const filesBasePath = optional('FILES_BASE_PATH');

module.exports = {
  port: Number(process.env.PORT || 5500),
  nodeEnv: optional('NODE_ENV', 'development'),
  corsOrigin: optional('CORS_ORIGIN', '*'),
  db: {
    host: must('DB_HOST'),
    port: Number(process.env.DB_PORT || 5432),
    user: must('DB_USER'),
    password: must('DB_PASSWORD'),
    database: must('DB_NAME'),
    ssl: parseBoolean(process.env.DB_SSL, false),
    schema: optional('DB_SCHEMA', 'marzo')
  },
  filesBasePath: filesBasePath ? path.resolve(filesBasePath) : '',
  publicBaseUrl: must('PUBLIC_BASE_URL').replace(/\/$/, ''),
  shareTokenLength: Number(process.env.SHARE_TOKEN_LENGTH || 48),
  defaultPinLength: Number(process.env.DEFAULT_PIN_LENGTH || 5),
  pinAccessSecret: must('SHARE_ACCESS_SECRET'),
  pinAccessTokenTtlMinutes: Number(process.env.PIN_ACCESS_TOKEN_TTL_MINUTES || 30),
  auth: {
    userIdHeader: optional('AUTH_USER_ID_HEADER', 'x-user-id').toLowerCase(),
    userSubHeader: optional('AUTH_USER_SUB_HEADER', 'x-auth-user-sub').toLowerCase(),
    userIdClaims: parseList(process.env.AUTH_USER_ID_CLAIMS, ['https://symplia.app/idUsuario', 'idUsuario', 'user_id'])
  }
};
