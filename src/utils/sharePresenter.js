function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function presentDocument(document) {
  return {
    idHistorialDocumentoGuardado: Number(document.idHistorialDocumentoGuardado),
    orden: document.orden !== undefined && document.orden !== null ? Number(document.orden) : null,
    nombreArchivo: document.nombreSnapshot || document.nombreArchivo || null,
    mimeType: document.mimeType || null,
    pesoArchivoBytes: document.pesoArchivoBytes !== undefined && document.pesoArchivoBytes !== null
      ? Number(document.pesoArchivoBytes)
      : null
  };
}

function presentShare(share, documents = []) {
  return {
    idShareTemporal: Number(share.idShareTemporal),
    codigo: share.codigo,
    fechaCreacion: toIso(share.fechaCreacion),
    fechaExpiracion: toIso(share.fechaExpiracion),
    duracionMinutos: Number(share.duracionMinutos),
    idUsuarioGenerador: share.idUsuarioGenerador !== undefined && share.idUsuarioGenerador !== null
      ? Number(share.idUsuarioGenerador)
      : null,
    estado: share.estadoNombre || share.nombreEstado || null,
    requierePin: Boolean(share.requierePin),
    permiteVisualizacion: Boolean(share.permiteVisualizacion),
    permiteDescarga: Boolean(share.permiteDescarga),
    descargarComoZip: Boolean(share.descargarComoZip),
    singleUse: Boolean(share.singleUse),
    maxAccesos: share.maxAccesos !== null && share.maxAccesos !== undefined ? Number(share.maxAccesos) : null,
    accesosActuales: Number(share.accesosActuales || 0),
    maxDescargas: share.maxDescargas !== null && share.maxDescargas !== undefined ? Number(share.maxDescargas) : null,
    descargasActuales: Number(share.descargasActuales || 0),
    observaciones: share.observaciones || null,
    urlPublica: share.urlPublica,
    documentos: documents.map(presentDocument)
  };
}

function presentPublicShare(share, documents = [], options = {}) {
  const base = {
    codigo: share.codigo,
    fechaExpiracion: toIso(share.fechaExpiracion),
    requierePin: Boolean(share.requierePin),
    permiteVisualizacion: Boolean(share.permiteVisualizacion),
    permiteDescarga: Boolean(share.permiteDescarga),
    descargarComoZip: Boolean(share.descargarComoZip),
    singleUse: Boolean(share.singleUse),
    accessGranted: Boolean(options.accessGranted),
    documentos: options.includeDocuments ? documents.map(presentDocument) : []
  };

  if (!options.includeDocuments) {
    base.documentCount = documents.length;
  }

  if (options.pinAccessToken) {
    base.pinAccessToken = options.pinAccessToken;
  }

  return base;
}

module.exports = {
  presentShare,
  presentPublicShare,
  presentDocument
};
