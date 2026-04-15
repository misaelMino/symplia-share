const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const AppError = require('../utils/appError');
const { ensureFileExists, resolveStoredPath, getMimeType } = require('../utils/fileResolver');

function resolveDocumentFile(document) {
  const absolutePath = resolveStoredPath(document.rutaSnapshot);
  if (!ensureFileExists(absolutePath)) {
    throw new AppError('El archivo compartido no está disponible', 404, 'FILE_NOT_FOUND');
  }

  return {
    absolutePath,
    downloadName: document.nombreSnapshot || path.basename(absolutePath),
    mimeType: document.mimeType || getMimeType(absolutePath, document.nombreSnapshot)
  };
}

function streamInlineFile(res, document) {
  const resolved = resolveDocumentFile(document);
  res.setHeader('Content-Type', resolved.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(resolved.downloadName)}"`);
  return fs.createReadStream(resolved.absolutePath).pipe(res);
}

function streamDownloadFile(res, document) {
  const resolved = resolveDocumentFile(document);
  res.setHeader('Content-Type', resolved.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(resolved.downloadName)}"`);
  return fs.createReadStream(resolved.absolutePath).pipe(res);
}

function streamZip(res, share, documents) {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${share.codigo || 'share'}-documentos.zip"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (error) => {
    throw error;
  });

  archive.pipe(res);

  documents.forEach((document) => {
    const resolved = resolveDocumentFile(document);
    archive.file(resolved.absolutePath, { name: resolved.downloadName });
  });

  archive.finalize();
}

module.exports = {
  resolveDocumentFile,
  streamInlineFile,
  streamDownloadFile,
  streamZip
};
