const crypto = require('crypto');
const bcrypt = require('bcryptjs');

function generatePublicToken(length) {
  const bytes = Math.max(32, Math.ceil(length * 0.75));
  return crypto
    .randomBytes(bytes)
    .toString('base64url')
    .slice(0, length);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

async function hashPin(pin) {
  return bcrypt.hash(String(pin), 10);
}

async function comparePin(pin, hash) {
  if (!hash) return false;
  return bcrypt.compare(String(pin), hash);
}

module.exports = {
  generatePublicToken,
  sha256,
  hashPin,
  comparePin
};
