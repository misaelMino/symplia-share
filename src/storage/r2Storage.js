const { AppError } = require('../utils/appError');
const { r2 } = require('../config/env');

const {
  S3Client,
  GetObjectCommand,
} = require('@aws-sdk/client-s3');

let client = null;

function ensureConfigured() {
  const endpoint = r2.endpoint || (r2.accountId ? `https://${r2.accountId}.r2.cloudflarestorage.com` : '');
  const missing = [];
  if (!r2.accessKeyId) missing.push('R2_ACCESS_KEY_ID');
  if (!r2.secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');
  if (!r2.bucket) missing.push('R2_BUCKET');
  if (!endpoint) missing.push('R2_ENDPOINT o R2_ACCOUNT_ID');

  if (missing.length) {
    throw new AppError(
      `Storage R2 no configurado. Falta completar: ${missing.join(', ')}`,
      503,
      'R2_NOT_CONFIGURED'
    );
  }

  return endpoint;
}

function getClient() {
  if (client) return client;

  client = new S3Client({
    region: r2.region || 'auto',
    endpoint: ensureConfigured(),
    forcePathStyle: true,
    credentials: {
      accessKeyId: r2.accessKeyId,
      secretAccessKey: r2.secretAccessKey,
    },
  });

  return client;
}

function isRutaArchivoR2(rutaArchivo) {
  return typeof rutaArchivo === 'string' && rutaArchivo.startsWith('r2://');
}

function resolveObjectKeyFromRuta(rutaArchivo) {
  const prefix = 'r2://';
  if (!isRutaArchivoR2(rutaArchivo)) {
    throw new AppError('La ruta del archivo no tiene un formato R2 válido.', 500, 'INVALID_STORAGE_PATH');
  }

  const value = String(rutaArchivo).slice(prefix.length);
  const firstSlash = value.indexOf('/');
  if (firstSlash < 0) {
    throw new AppError('La ruta del archivo no tiene un formato R2 válido.', 500, 'INVALID_STORAGE_PATH');
  }

  return value.slice(firstSlash + 1);
}

async function getObjectStreamByRuta(rutaArchivo) {
  const objectKey = resolveObjectKeyFromRuta(rutaArchivo);
  return getClient().send(new GetObjectCommand({
    Bucket: r2.bucket,
    Key: objectKey,
  }));
}

module.exports = {
  isRutaArchivoR2,
  getObjectStreamByRuta,
};
