const pool = require('../config/database');
const { publicBaseUrl, shareTokenLength, defaultPinLength } = require('../config/env');
const shareRepository = require('../repositories/shareRepository');
const documentService = require('./documentService');
const accessLogService = require('./accessLogService');
const AppError = require('../utils/appError');
const { generatePublicToken, sha256, hashPin, comparePin } = require('../utils/crypto');
const { formatShareCode } = require('../utils/shareCode');
const { presentPublicShare, presentShare } = require('../utils/sharePresenter');
const { createPinAccessToken, verifyPinAccessToken } = require('../utils/pinAccessToken');
const { resolveStoredPath, ensureFileExists } = require('../utils/fileResolver');
const { isRutaArchivoR2 } = require('../storage/r2Storage');
const SHARE_STATES = require('../constants/shareStates');
const ACCESS_ACTIONS = require('../constants/accessActions');
const ACCESS_RESULTS = require('../constants/accessResults');

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  return Boolean(value);
}

function parseNullablePositiveInt(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(`El campo ${fieldName} debe ser un entero positivo`, 400, 'INVALID_INPUT');
  }
  return parsed;
}

function buildPublicUrl(token) {
  return `${publicBaseUrl}/public/shares/${token}`;
}

async function ensureShareStates(client) {
  const stateMap = await shareRepository.getStateMap(client);
  const missing = Object.values(SHARE_STATES).filter((state) => !stateMap[state]);
  if (missing.length) {
    throw new AppError('Faltan estados base de ShareTemporal en la base de datos', 500, 'SHARE_STATES_MISSING', { missing });
  }
  return stateMap;
}

function determineEffectiveMaxAccesos(payload) {
  if (payload.singleUse) return 1;
  return payload.maxAccesos;
}

function isExpired(share) {
  return new Date(share.fechaExpiracion).getTime() <= Date.now();
}

async function transitionIfExpired(share, stateMap, client) {
  if (!share || share.estadoNombre === SHARE_STATES.EXPIRADO || !isExpired(share)) return share;
  return shareRepository.updateShareFields(share.idShareTemporal, {
    idEstadoShare: stateMap[SHARE_STATES.EXPIRADO]
  }, client);
}

function withEffectiveState(share) {
  if (!share) return share;
  if (share.estadoNombre === SHARE_STATES.REVOCADO || share.estadoNombre === SHARE_STATES.CONSUMIDO) {
    return share;
  }
  if (!isExpired(share)) return share;
  return {
    ...share,
    estadoNombre: SHARE_STATES.EXPIRADO
  };
}

async function resolvePublicShareOrFail(plainToken, client) {
  const tokenHash = sha256(plainToken);
  const share = await shareRepository.getShareByTokenHash(tokenHash, client);
  if (!share) {
    throw new AppError('Share no encontrado', 404, 'SHARE_NOT_FOUND');
  }
  return { share, tokenHash };
}

async function validateAvailability({ req, share, stateMap, client, forDownload = false }) {
  let currentShare = await transitionIfExpired(share, stateMap, client);
  currentShare = currentShare || share;

  if (currentShare.estadoNombre === SHARE_STATES.REVOCADO) {
    await accessLogService.register(req, {
      idShareTemporal: currentShare.idShareTemporal,
      accion: ACCESS_ACTIONS.DENY_REVOKED,
      resultado: ACCESS_RESULTS.DENY,
      detalle: 'Share revocado'
    }, client);
    throw new AppError('El share fue revocado', 403, 'SHARE_REVOKED');
  }

  if (currentShare.estadoNombre === SHARE_STATES.EXPIRADO || isExpired(currentShare)) {
    await accessLogService.register(req, {
      idShareTemporal: currentShare.idShareTemporal,
      accion: ACCESS_ACTIONS.DENY_EXPIRED,
      resultado: ACCESS_RESULTS.DENY,
      detalle: 'Share expirado'
    }, client);
    throw new AppError('El share expiró', 410, 'SHARE_EXPIRED');
  }

  const effectiveMaxAccesos = currentShare.singleUse ? 1 : currentShare.maxAccesos;
  if (effectiveMaxAccesos && Number(currentShare.accesosActuales) >= Number(effectiveMaxAccesos)) {
    await shareRepository.updateShareFields(currentShare.idShareTemporal, {
      idEstadoShare: stateMap[SHARE_STATES.CONSUMIDO]
    }, client);
    await accessLogService.register(req, {
      idShareTemporal: currentShare.idShareTemporal,
      accion: ACCESS_ACTIONS.DENY_LIMIT,
      resultado: ACCESS_RESULTS.DENY,
      detalle: 'Límite de accesos alcanzado'
    }, client);
    throw new AppError('El share alcanzó su límite de accesos', 403, 'SHARE_LIMIT_REACHED');
  }

  if (forDownload && currentShare.maxDescargas && Number(currentShare.descargasActuales) >= Number(currentShare.maxDescargas)) {
    await accessLogService.register(req, {
      idShareTemporal: currentShare.idShareTemporal,
      accion: ACCESS_ACTIONS.DENY_LIMIT,
      resultado: ACCESS_RESULTS.DENY,
      detalle: 'Límite de descargas alcanzado'
    }, client);
    throw new AppError('El share alcanzó su límite de descargas', 403, 'SHARE_DOWNLOAD_LIMIT_REACHED');
  }

  return currentShare;
}

function assertPinRules(payload) {
  if (payload.requierePin) {
    if (!payload.pin || String(payload.pin).trim().length < defaultPinLength) {
      throw new AppError(`El PIN debe tener al menos ${defaultPinLength} caracteres`, 400, 'PIN_REQUIRED');
    }
  }

  if (!payload.permiteVisualizacion && !payload.permiteDescarga) {
    throw new AppError('Debe habilitar visualización, descarga, o ambas', 400, 'NO_ACCESS_MODE');
  }
}

async function createShare({ authUser, body }) {
  const idUsuarioGenerador = Number(authUser?.idUsuario);
  if (!Number.isInteger(idUsuarioGenerador) || idUsuarioGenerador <= 0) {
    throw new AppError('Usuario generador inválido', 401, 'AUTH_USER_REQUIRED');
  }

  const duracionMinutos = Number(body?.duracionMinutos);
  if (!Number.isInteger(duracionMinutos) || duracionMinutos <= 0) {
    throw new AppError('duracionMinutos debe ser un entero positivo', 400, 'INVALID_DURATION');
  }

  const payload = {
    documentIds: body?.documentIds,
    duracionMinutos,
    requierePin: normalizeBoolean(body?.requierePin, false),
    pin: body?.pin,
    permiteVisualizacion: normalizeBoolean(body?.permiteVisualizacion, true),
    permiteDescarga: normalizeBoolean(body?.permiteDescarga, true),
    descargarComoZip: normalizeBoolean(body?.descargarComoZip, false),
    singleUse: normalizeBoolean(body?.singleUse, false),
    maxAccesos: parseNullablePositiveInt(body?.maxAccesos, 'maxAccesos'),
    maxDescargas: parseNullablePositiveInt(body?.maxDescargas, 'maxDescargas'),
    observaciones: body?.observaciones ? String(body.observaciones).trim() : null
  };

  assertPinRules(payload);

  const documents = await documentService.getDocumentsForShareCreation(payload.documentIds);
  if (documents.length === 1) {
    payload.descargarComoZip = false;
  }

  const publicToken = generatePublicToken(shareTokenLength);
  const shareTokenHash = sha256(publicToken);
  const pinHash = payload.requierePin ? await hashPin(payload.pin) : null;
  const fechaCreacion = new Date();
  const fechaExpiracion = new Date(fechaCreacion.getTime() + (duracionMinutos * 60 * 1000));
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const stateMap = await ensureShareStates(client);
    const provisionalCode = `TMP-${Date.now()}`;
    const provisionalUrl = buildPublicUrl(publicToken);

    const created = await shareRepository.createShare({
      codigo: provisionalCode,
      shareTokenHash,
      fechaCreacion,
      fechaExpiracion,
      duracionMinutos,
      idUsuarioGenerador,
      idEstadoShare: stateMap[SHARE_STATES.ACTIVO],
      requierePin: payload.requierePin,
      pinHash,
      permiteVisualizacion: payload.permiteVisualizacion,
      permiteDescarga: payload.permiteDescarga,
      descargarComoZip: payload.descargarComoZip,
      singleUse: payload.singleUse,
      maxAccesos: determineEffectiveMaxAccesos(payload),
      maxDescargas: payload.maxDescargas,
      urlPublica: provisionalUrl,
      observaciones: payload.observaciones
    }, client);

    const codigo = formatShareCode(Number(created.idShareTemporal), created.fechaCreacion || new Date());
    const urlPublica = buildPublicUrl(publicToken);

    const updated = await shareRepository.updateShareFields(created.idShareTemporal, {
      codigo,
      urlPublica
    }, client);

    await shareRepository.insertDocuments(updated.idShareTemporal, documents, client);
    await client.query('COMMIT');

    return {
      ok: true,
      data: {
        idShareTemporal: Number(updated.idShareTemporal),
        codigo: updated.codigo,
        fechaExpiracion: new Date(updated.fechaExpiracion).toISOString(),
        requierePin: Boolean(updated.requierePin),
        permiteVisualizacion: Boolean(updated.permiteVisualizacion),
        permiteDescarga: Boolean(updated.permiteDescarga),
        descargarComoZip: Boolean(updated.descargarComoZip),
        urlPublica,
        publicToken
      }
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function attachQrBase64(data) {
  const QRCode = require('qrcode');
  const qrBase64 = await QRCode.toDataURL(data.urlPublica);
  return {
    ...data,
    qrBase64
  };
}

async function createShareWithQr(context) {
  const created = await createShare(context);
  created.data = await attachQrBase64(created.data);
  return created;
}

async function listSharesForUser(idUsuarioGenerador, filters = {}) {
  const client = await pool.connect();

  try {
    const stateMap = await ensureShareStates(client);
    const shares = await shareRepository.listSharesByUser(idUsuarioGenerador, filters, client);
    const normalizedShares = await Promise.all(
      shares.map(async (share) => {
        const transitioned = await transitionIfExpired(share, stateMap, client);
        return withEffectiveState(transitioned || share);
      })
    );

    return normalizedShares.map((share) => ({
      idShareTemporal: Number(share.idShareTemporal),
      codigo: share.codigo,
      fechaCreacion: new Date(share.fechaCreacion).toISOString(),
      fechaExpiracion: new Date(share.fechaExpiracion).toISOString(),
      estado: share.estadoNombre,
      requierePin: Boolean(share.requierePin),
      permiteVisualizacion: Boolean(share.permiteVisualizacion),
      permiteDescarga: Boolean(share.permiteDescarga),
      descargarComoZip: Boolean(share.descargarComoZip),
      accesosActuales: Number(share.accesosActuales || 0),
      descargasActuales: Number(share.descargasActuales || 0),
      documentCount: Number(share.documentCount || 0),
      urlPublica: share.urlPublica
    }));
  } finally {
    client.release();
  }
}

async function getShareDetailForUser(idShareTemporal, idUsuarioGenerador) {
  const client = await pool.connect();

  try {
    const stateMap = await ensureShareStates(client);
    const share = await shareRepository.getShareByIdForUser(idShareTemporal, idUsuarioGenerador, client);
    if (!share) {
      throw new AppError('Share no encontrado', 404, 'SHARE_NOT_FOUND');
    }
    const normalizedShare = withEffectiveState(
      (await transitionIfExpired(share, stateMap, client)) || share
    );
    const documents = await shareRepository.getDocumentsByShareId(idShareTemporal, client);
    return presentShare(normalizedShare, documents);
  } finally {
    client.release();
  }
}

async function revokeShare(idShareTemporal, idUsuarioGenerador, req) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const stateMap = await ensureShareStates(client);
    const share = await shareRepository.getShareByIdForUser(idShareTemporal, idUsuarioGenerador, client);

    if (!share) {
      throw new AppError('Share no encontrado', 404, 'SHARE_NOT_FOUND');
    }

    await shareRepository.updateShareFields(idShareTemporal, {
      idEstadoShare: stateMap[SHARE_STATES.REVOCADO]
    }, client);

    const updated = await shareRepository.getShareById(idShareTemporal, client);

    await accessLogService.register(req, {
      idShareTemporal,
      accion: ACCESS_ACTIONS.REVOKE,
      resultado: ACCESS_RESULTS.OK,
      detalle: 'Share revocado manualmente'
    }, client);

    await client.query('COMMIT');
    return presentShare(updated);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function extractPinAccessToken(req) {
  return req.query.pinAccessToken || req.headers['x-share-pin-token'] || null;
}

function validatePinAccessForShare(req, share, tokenHash) {
  if (!share.requierePin) return true;
  const pinAccessToken = extractPinAccessToken(req);
  const payload = verifyPinAccessToken(pinAccessToken);
  if (!payload) return false;
  return Number(payload.idShareTemporal) === Number(share.idShareTemporal) && payload.tokenHash === tokenHash;
}

async function getPublicShareMetadata(req, plainToken) {
  const client = await pool.connect();

  try {
    const stateMap = await ensureShareStates(client);
    const { share, tokenHash } = await resolvePublicShareOrFail(plainToken, client);
    const availableShare = await validateAvailability({ req, share, stateMap, client });
    const documents = await shareRepository.getDocumentsByShareId(availableShare.idShareTemporal, client);
    const accessGranted = validatePinAccessForShare(req, availableShare, tokenHash);
    const includeDocuments = !availableShare.requierePin || accessGranted;

    await accessLogService.register(req, {
      idShareTemporal: availableShare.idShareTemporal,
      accion: ACCESS_ACTIONS.OPEN,
      resultado: ACCESS_RESULTS.OK,
      detalle: includeDocuments ? 'Metadata pública con acceso' : 'Metadata pública requiere PIN'
    }, client);

    return presentPublicShare(availableShare, documents, {
      includeDocuments,
      accessGranted
    });
  } finally {
    client.release();
  }
}

async function validateSharePin(req, plainToken, pin) {
  const client = await pool.connect();

  try {
    const stateMap = await ensureShareStates(client);
    const { share, tokenHash } = await resolvePublicShareOrFail(plainToken, client);
    const availableShare = await validateAvailability({ req, share, stateMap, client });

    if (!availableShare.requierePin) {
      return {
        accessGranted: true,
        pinAccessToken: null
      };
    }

    const ok = await comparePin(pin, availableShare.pinHash);
    await accessLogService.register(req, {
      idShareTemporal: availableShare.idShareTemporal,
      accion: ok ? ACCESS_ACTIONS.PIN_OK : ACCESS_ACTIONS.PIN_FAIL,
      resultado: ok ? ACCESS_RESULTS.OK : ACCESS_RESULTS.DENY,
      detalle: ok ? 'PIN correcto' : 'PIN inválido'
    }, client);

    if (!ok) {
      throw new AppError('PIN inválido', 401, 'INVALID_PIN');
    }

    return {
      accessGranted: true,
      pinAccessToken: createPinAccessToken({
        idShareTemporal: Number(availableShare.idShareTemporal),
        tokenHash
      })
    };
  } finally {
    client.release();
  }
}

async function resolvePublicDocumentAccess(req, plainToken, idHistorialDocumentoGuardado, options = {}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const stateMap = await ensureShareStates(client);
    const { share, tokenHash } = await resolvePublicShareOrFail(plainToken, client);
    const availableShare = await validateAvailability({ req, share, stateMap, client, forDownload: options.forDownload });

    if (availableShare.requierePin && !validatePinAccessForShare(req, availableShare, tokenHash)) {
      throw new AppError('PIN requerido o token PIN inválido', 401, 'PIN_REQUIRED');
    }

    const document = await shareRepository.getDocumentInShare(availableShare.idShareTemporal, idHistorialDocumentoGuardado, client);
    if (!document) {
      throw new AppError('Documento no disponible en el share', 404, 'SHARE_DOCUMENT_NOT_FOUND');
    }

    const isR2Document = isRutaArchivoR2(document.rutaSnapshot);
    const resolvedPath = isR2Document ? document.rutaSnapshot : resolveStoredPath(document.rutaSnapshot);
    if (!isR2Document && !ensureFileExists(resolvedPath)) {
      await accessLogService.register(req, {
        idShareTemporal: availableShare.idShareTemporal,
        accion: options.logAction,
        resultado: ACCESS_RESULTS.ERROR,
        detalle: `Archivo faltante para documento ${idHistorialDocumentoGuardado}`
      }, client);
      throw new AppError('El archivo compartido no está disponible', 404, 'FILE_NOT_FOUND');
    }

    if (options.mode === 'view' && !availableShare.permiteVisualizacion) {
      throw new AppError('La visualización no está permitida para este share', 403, 'VIEW_NOT_ALLOWED');
    }

    if (options.mode === 'download' && !availableShare.permiteDescarga) {
      throw new AppError('La descarga no está permitida para este share', 403, 'DOWNLOAD_NOT_ALLOWED');
    }

    const updatedFields = {
      accesosActuales: Number(availableShare.accesosActuales || 0) + 1
    };

    if (options.forDownload) {
      updatedFields.descargasActuales = Number(availableShare.descargasActuales || 0) + 1;
    }

    const updatedShare = await shareRepository.updateShareFields(availableShare.idShareTemporal, updatedFields, client);

    await accessLogService.register(req, {
      idShareTemporal: availableShare.idShareTemporal,
      accion: options.logAction,
      resultado: ACCESS_RESULTS.OK,
      detalle: `Documento ${idHistorialDocumentoGuardado}`
    }, client);

    await client.query('COMMIT');

    return {
      share: updatedShare || availableShare,
      document
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function resolvePublicZipAccess(req, plainToken) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const stateMap = await ensureShareStates(client);
    const { share, tokenHash } = await resolvePublicShareOrFail(plainToken, client);
    const availableShare = await validateAvailability({ req, share, stateMap, client, forDownload: true });

    if (availableShare.requierePin && !validatePinAccessForShare(req, availableShare, tokenHash)) {
      throw new AppError('PIN requerido o token PIN inválido', 401, 'PIN_REQUIRED');
    }

    if (!availableShare.permiteDescarga) {
      throw new AppError('La descarga no está permitida para este share', 403, 'DOWNLOAD_NOT_ALLOWED');
    }

    if (!availableShare.descargarComoZip) {
      throw new AppError('Este share no permite descarga ZIP', 403, 'ZIP_NOT_ALLOWED');
    }

    const documents = await shareRepository.getDocumentsByShareId(availableShare.idShareTemporal, client);
    if (documents.length < 2) {
      throw new AppError('La descarga ZIP requiere múltiples documentos', 400, 'ZIP_REQUIRES_MULTIPLE_DOCUMENTS');
    }

    const missingDocument = documents.find((document) => (
      !isRutaArchivoR2(document.rutaSnapshot) &&
      !ensureFileExists(resolveStoredPath(document.rutaSnapshot))
    ));
    if (missingDocument) {
      await accessLogService.register(req, {
        idShareTemporal: availableShare.idShareTemporal,
        accion: ACCESS_ACTIONS.ZIP_DOWNLOAD,
        resultado: ACCESS_RESULTS.ERROR,
        detalle: `Archivo faltante para documento ${missingDocument.idHistorialDocumentoGuardado}`
      }, client);
      throw new AppError('Uno de los archivos del share no está disponible', 404, 'FILE_NOT_FOUND');
    }

    const updatedShare = await shareRepository.updateShareFields(availableShare.idShareTemporal, {
      accesosActuales: Number(availableShare.accesosActuales || 0) + 1,
      descargasActuales: Number(availableShare.descargasActuales || 0) + 1
    }, client);

    await accessLogService.register(req, {
      idShareTemporal: availableShare.idShareTemporal,
      accion: ACCESS_ACTIONS.ZIP_DOWNLOAD,
      resultado: ACCESS_RESULTS.OK,
      detalle: `ZIP con ${documents.length} documentos`
    }, client);

    await client.query('COMMIT');

    return {
      share: updatedShare || availableShare,
      documents
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createShareWithQr,
  listSharesForUser,
  getShareDetailForUser,
  revokeShare,
  getPublicShareMetadata,
  validateSharePin,
  resolvePublicDocumentAccess,
  resolvePublicZipAccess
};
