const crypto = require('crypto');
const { pinAccessSecret, pinAccessTokenTtlMinutes } = require('../config/env');

function encode(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function sign(payload) {
  return crypto.createHmac('sha256', pinAccessSecret).update(payload).digest('base64url');
}

function createPinAccessToken({ idShareTemporal, tokenHash }) {
  const payload = {
    idShareTemporal,
    tokenHash,
    exp: Date.now() + (pinAccessTokenTtlMinutes * 60 * 1000)
  };

  const encodedPayload = encode(payload);
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

function verifyPinAccessToken(token) {
  if (!token || !String(token).includes('.')) return null;
  const [encodedPayload, encodedSignature] = String(token).split('.');
  const expectedSignature = sign(encodedPayload);

  const signatureBuffer = Buffer.from(encodedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  if (!payload.exp || Number(payload.exp) < Date.now()) return null;
  return payload;
}

module.exports = {
  createPinAccessToken,
  verifyPinAccessToken
};
