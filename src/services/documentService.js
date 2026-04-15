const AppError = require('../utils/appError');
const documentRepository = require('../repositories/documentRepository');
const { getMimeType } = require('../utils/fileResolver');

async function getDocumentsForShareCreation(documentIds) {
  const ids = Array.from(new Set((documentIds || []).map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)));

  if (!ids.length) {
    throw new AppError('Debe enviar al menos un documento válido', 400, 'DOCUMENT_IDS_REQUIRED');
  }

  const documents = await documentRepository.getDocumentsByIds(ids);

  if (documents.length !== ids.length) {
    const foundIds = new Set(documents.map((doc) => Number(doc.idHistorialDocumentoGuardado)));
    const missingIds = ids.filter((id) => !foundIds.has(id));
    throw new AppError('Hay documentos inexistentes para compartir', 404, 'DOCUMENTS_NOT_FOUND', { missingIds });
  }

  return ids.map((id, index) => {
    const document = documents.find((item) => Number(item.idHistorialDocumentoGuardado) === id);
    return {
      idHistorialDocumentoGuardado: Number(document.idHistorialDocumentoGuardado),
      orden: index + 1,
      nombreSnapshot: document.nombreArchivo,
      nombreArchivoFisico: document.nombreArchivoFisico,
      rutaSnapshot: document.rutaArchivo,
      pesoArchivoBytes: document.tamanoArchivo ? Number(document.tamanoArchivo) : null,
      mimeType: getMimeType(document.rutaArchivo, document.nombreArchivo)
    };
  });
}

module.exports = {
  getDocumentsForShareCreation
};
