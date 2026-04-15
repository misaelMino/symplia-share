const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const { filesBasePath } = require('../config/env');

function resolveStoredPath(rutaArchivo) {
  if (!rutaArchivo) return '';
  if (path.isAbsolute(rutaArchivo)) return path.normalize(rutaArchivo);
  if (!filesBasePath) return path.normalize(rutaArchivo);
  return path.normalize(path.join(filesBasePath, rutaArchivo));
}

function ensureFileExists(resolvedPath) {
  return fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile();
}

function getMimeType(filePath, fallbackName = '') {
  return mime.lookup(filePath) || mime.lookup(fallbackName) || 'application/octet-stream';
}

module.exports = {
  resolveStoredPath,
  ensureFileExists,
  getMimeType
};
