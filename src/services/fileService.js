const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const AppError = require('../utils/appError');
const { ensureFileExists, resolveStoredPath, getMimeType } = require('../utils/fileResolver');
const { isRutaArchivoR2, getObjectStreamByRuta } = require('../storage/r2Storage');

function buildResolvedMetadata(document, fallbackPath = '') {
  return {
    downloadName: document.nombreSnapshot || path.basename(fallbackPath || 'archivo'),
    mimeType: document.mimeType || getMimeType(fallbackPath, document.nombreSnapshot),
  };
}

async function resolveDocumentFile(document) {
  if (isRutaArchivoR2(document.rutaSnapshot)) {
    const remote = await getObjectStreamByRuta(document.rutaSnapshot);
    return {
      ...buildResolvedMetadata(document),
      source: 'r2',
      stream: remote.Body,
    };
  }

  const absolutePath = resolveStoredPath(document.rutaSnapshot);
  if (!ensureFileExists(absolutePath)) {
    throw new AppError('El archivo compartido no estÃ¡ disponible', 404, 'FILE_NOT_FOUND');
  }

  return {
    ...buildResolvedMetadata(document, absolutePath),
    source: 'file',
    absolutePath,
  };
}

async function streamInlineFile(res, document) {
  const resolved = await resolveDocumentFile(document);
  res.setHeader('Content-Type', resolved.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(resolved.downloadName)}"`);
  const stream = resolved.source === 'r2' ? resolved.stream : fs.createReadStream(resolved.absolutePath);
  return stream.pipe(res);
}

async function streamDownloadFile(res, document) {
  const resolved = await resolveDocumentFile(document);
  res.setHeader('Content-Type', resolved.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(resolved.downloadName)}"`);
  const stream = resolved.source === 'r2' ? resolved.stream : fs.createReadStream(resolved.absolutePath);
  return stream.pipe(res);
}

async function streamZip(res, share, documents) {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${share.codigo || 'share'}-documentos.zip"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (error) => {
    throw error;
  });

  archive.pipe(res);

  for (const document of documents) {
    const resolved = await resolveDocumentFile(document);
    if (resolved.source === 'r2') {
      archive.append(resolved.stream, { name: resolved.downloadName });
    } else {
      archive.file(resolved.absolutePath, { name: resolved.downloadName });
    }
  }

  archive.finalize();
}

module.exports = {
  resolveDocumentFile,
  streamInlineFile,
  streamDownloadFile,
  streamZip,
};
