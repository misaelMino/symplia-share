function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function normalizePersonas(personas) {
  if (!Array.isArray(personas)) return [];
  return personas
    .map((persona) => ({
      idPersona:
        persona?.idPersona !== undefined && persona?.idPersona !== null
          ? Number(persona.idPersona)
          : null,
      nombreCompleto: persona?.nombreCompleto || null
    }))
    .filter((persona) => persona.idPersona);
}

function normalizeDocumentos(documentos) {
  if (!Array.isArray(documentos)) return [];
  return documentos
    .map((documento) => ({
      idDocumento:
        documento?.idDocumento !== undefined && documento?.idDocumento !== null
          ? Number(documento.idDocumento)
          : null,
      nombre: documento?.nombre || null
    }))
    .filter((documento) => documento.idDocumento);
}

function buildPersonaResumen(personas, personCount) {
  if (!personCount || !personas.length) return null;
  if (personCount === 1) return personas[0].nombreCompleto || `Persona ${personas[0].idPersona}`;
  const preview = personas
    .slice(0, 2)
    .map((persona) => persona.nombreCompleto || `Persona ${persona.idPersona}`)
    .filter(Boolean);
  if (!preview.length) return `${personCount} personas`;
  return `${preview.join(' • ')}${personCount > preview.length ? ` +${personCount - preview.length}` : ''}`;
}

function buildDocumentosResumen(documentos, documentCount) {
  if (!documentCount || !documentos.length) return null;
  if (documentCount === 1) return documentos[0].nombre || `Documento ${documentos[0].idDocumento}`;
  const firstLabel = documentos[0].nombre || `Documento ${documentos[0].idDocumento}`;
  return `${firstLabel} +${documentCount - 1}`;
}

function presentDocument(document) {
  return {
    idHistorialDocumentoGuardado: Number(document.idHistorialDocumentoGuardado),
    orden: document.orden !== undefined && document.orden !== null ? Number(document.orden) : null,
    nombreArchivo: document.nombreSnapshot || document.nombreArchivo || null,
    idDocumento: document.idDocumento !== undefined && document.idDocumento !== null
      ? Number(document.idDocumento)
      : null,
    documentoNombre: document.documentoNombre || null,
    idPersona: document.idPersona !== undefined && document.idPersona !== null
      ? Number(document.idPersona)
      : null,
    personaNombre: document.personaNombre || null,
    mimeType: document.mimeType || null,
    pesoArchivoBytes: document.pesoArchivoBytes !== undefined && document.pesoArchivoBytes !== null
      ? Number(document.pesoArchivoBytes)
      : null
  };
}

function presentShare(share, documents = []) {
  const personas = normalizePersonas(share.personas);
  const documentos = normalizeDocumentos(share.documentos);
  const personCount = share.personCount !== undefined && share.personCount !== null
    ? Number(share.personCount)
    : personas.length;
  const documentCount = share.documentCount !== undefined && share.documentCount !== null
    ? Number(share.documentCount)
    : documents.length;

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
    documentCount,
    personCount,
    primaryIdPersona: share.primaryIdPersona !== undefined && share.primaryIdPersona !== null
      ? Number(share.primaryIdPersona)
      : (personCount === 1 && personas[0]?.idPersona ? personas[0].idPersona : null),
    personas,
    personaResumen: buildPersonaResumen(personas, personCount),
    documentosResumen: buildDocumentosResumen(documentos, documentCount),
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
