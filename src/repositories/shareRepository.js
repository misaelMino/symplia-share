const pool = require('../config/database');
const { db } = require('../config/env');

const schema = db.schema;

function executor(client) {
  return client || pool;
}

async function getStateMap(client) {
  const sql = `SELECT "idEstadoShare", "nombre" FROM ${schema}."EstadoShare"`;
  const { rows } = await executor(client).query(sql);
  return rows.reduce((acc, row) => {
    acc[row.nombre] = Number(row.idEstadoShare);
    return acc;
  }, {});
}

async function createShare(data, client) {
  const sql = `
    INSERT INTO ${schema}."ShareTemporal" (
      "codigo",
      "shareTokenHash",
      "fechaCreacion",
      "fechaExpiracion",
      "duracionMinutos",
      "idUsuarioGenerador",
      "idEstadoShare",
      "requierePin",
      "pinHash",
      "permiteVisualizacion",
      "permiteDescarga",
      "descargarComoZip",
      "singleUse",
      "maxAccesos",
      "maxDescargas",
      "urlPublica",
      "observaciones"
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
    RETURNING *
  `;

  const values = [
    data.codigo,
    data.shareTokenHash,
    data.fechaCreacion,
    data.fechaExpiracion,
    data.duracionMinutos,
    data.idUsuarioGenerador,
    data.idEstadoShare,
    data.requierePin,
    data.pinHash,
    data.permiteVisualizacion,
    data.permiteDescarga,
    data.descargarComoZip,
    data.singleUse,
    data.maxAccesos,
    data.maxDescargas,
    data.urlPublica,
    data.observaciones
  ];

  const { rows } = await executor(client).query(sql, values);
  return rows[0];
}

async function updateShareFields(idShareTemporal, fields, client) {
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
  if (!entries.length) return null;

  const setClause = entries
    .map(([key], index) => `"${key}" = $${index + 2}`)
    .join(', ');

  const sql = `
    UPDATE ${schema}."ShareTemporal"
    SET ${setClause}
    WHERE "idShareTemporal" = $1
    RETURNING *
  `;

  const values = [idShareTemporal, ...entries.map(([, value]) => value)];
  const { rows } = await executor(client).query(sql, values);
  return rows[0];
}

async function insertDocuments(idShareTemporal, documents, client) {
  const dbClient = executor(client);
  const inserted = [];

  for (const document of documents) {
    const sql = `
      INSERT INTO ${schema}."ShareTemporalDocumento" (
        "idShareTemporal",
        "idHistorialDocumentoGuardado",
        "orden",
        "nombreSnapshot",
        "rutaSnapshot",
        "pesoArchivoBytes",
        "mimeType"
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
    `;

    const values = [
      idShareTemporal,
      document.idHistorialDocumentoGuardado,
      document.orden,
      document.nombreSnapshot,
      document.rutaSnapshot,
      document.pesoArchivoBytes,
      document.mimeType
    ];

    const { rows } = await dbClient.query(sql, values);
    inserted.push(rows[0]);
  }

  return inserted;
}

async function insertAccessLog(data, client) {
  const sql = `
    INSERT INTO ${schema}."ShareTemporalAcceso" (
      "idShareTemporal",
      "ip",
      "userAgent",
      "accion",
      "resultado",
      "detalle"
    )
    VALUES ($1,$2,$3,$4,$5,$6)
    RETURNING *
  `;

  const values = [
    data.idShareTemporal,
    data.ip,
    data.userAgent,
    data.accion,
    data.resultado,
    data.detalle
  ];

  const { rows } = await executor(client).query(sql, values);
  return rows[0];
}

async function getShareById(idShareTemporal, client) {
  const sql = `
    SELECT s.*, e."nombre" AS "estadoNombre"
    FROM ${schema}."ShareTemporal" s
    INNER JOIN ${schema}."EstadoShare" e ON e."idEstadoShare" = s."idEstadoShare"
    WHERE s."idShareTemporal" = $1
  `;
  const { rows } = await executor(client).query(sql, [idShareTemporal]);
  return rows[0] || null;
}

async function getShareByIdForUser(idShareTemporal, idUsuarioGenerador, client) {
  const sql = `
    SELECT s.*, e."nombre" AS "estadoNombre"
    FROM ${schema}."ShareTemporal" s
    INNER JOIN ${schema}."EstadoShare" e ON e."idEstadoShare" = s."idEstadoShare"
    WHERE s."idShareTemporal" = $1
      AND s."idUsuarioGenerador" = $2
  `;
  const { rows } = await executor(client).query(sql, [idShareTemporal, idUsuarioGenerador]);
  return rows[0] || null;
}

async function getShareByTokenHash(tokenHash, client) {
  const sql = `
    SELECT s.*, e."nombre" AS "estadoNombre"
    FROM ${schema}."ShareTemporal" s
    INNER JOIN ${schema}."EstadoShare" e ON e."idEstadoShare" = s."idEstadoShare"
    WHERE s."shareTokenHash" = $1
  `;
  const { rows } = await executor(client).query(sql, [tokenHash]);
  return rows[0] || null;
}

async function listSharesByUser(idUsuarioGenerador, filters = {}, client) {
  const values = [idUsuarioGenerador];
  const conditions = [`s."idUsuarioGenerador" = $1`];

  if (filters.estado) {
    values.push(filters.estado);
    conditions.push(`e."nombre" = $${values.length}`);
  }

  if (filters.activos === true) {
    conditions.push(`e."nombre" = 'ACTIVO'`);
    conditions.push(`s."fechaExpiracion" > CURRENT_TIMESTAMP`);
  }

  if (filters.expirados === true) {
    conditions.push(`(e."nombre" = 'EXPIRADO' OR s."fechaExpiracion" <= CURRENT_TIMESTAMP)`);
  }

  const sql = `
    SELECT
      s.*,
      e."nombre" AS "estadoNombre",
      COUNT(std."idShareTemporalDocumento")::int AS "documentCount",
      COUNT(DISTINCT d."idPersona")::int AS "personCount",
      CASE
        WHEN COUNT(DISTINCT d."idPersona") = 1 THEN MAX(d."idPersona")
        ELSE NULL
      END AS "primaryIdPersona",
      COALESCE(
        JSONB_AGG(
          DISTINCT JSONB_BUILD_OBJECT(
            'idPersona', d."idPersona",
            'nombreCompleto', NULLIF(CONCAT_WS(', ', p.apellido, p.nombre), '')
          )
        ) FILTER (WHERE d."idPersona" IS NOT NULL),
        '[]'::jsonb
      ) AS "personas",
      COALESCE(
        JSONB_AGG(
          DISTINCT JSONB_BUILD_OBJECT(
            'idDocumento', d."idDocumento",
            'nombre', d.nombre
          )
        ) FILTER (WHERE d."idDocumento" IS NOT NULL),
        '[]'::jsonb
      ) AS "documentos"
    FROM ${schema}."ShareTemporal" s
    INNER JOIN ${schema}."EstadoShare" e ON e."idEstadoShare" = s."idEstadoShare"
    LEFT JOIN ${schema}."ShareTemporalDocumento" std ON std."idShareTemporal" = s."idShareTemporal"
    LEFT JOIN ${schema}."HistorialDocumentoGuardado" hdg
      ON hdg."idHistorialDocumentoGuardado" = std."idHistorialDocumentoGuardado"
    LEFT JOIN ${schema}."Documento" d ON d."idDocumento" = hdg."idDocumento"
    LEFT JOIN ${schema}."Persona" p ON p."idPersona" = d."idPersona"
    WHERE ${conditions.join(' AND ')}
    GROUP BY s."idShareTemporal", e."nombre"
    ORDER BY s."fechaCreacion" DESC, s."idShareTemporal" DESC
  `;

  const { rows } = await executor(client).query(sql, values);
  return rows;
}

async function getDocumentsByShareId(idShareTemporal, client) {
  const sql = `
    SELECT
      std.*,
      hdg."idDocumento",
      d."idPersona",
      d.nombre AS "documentoNombre",
      NULLIF(CONCAT_WS(', ', p.apellido, p.nombre), '') AS "personaNombre"
    FROM ${schema}."ShareTemporalDocumento" std
    LEFT JOIN ${schema}."HistorialDocumentoGuardado" hdg
      ON hdg."idHistorialDocumentoGuardado" = std."idHistorialDocumentoGuardado"
    LEFT JOIN ${schema}."Documento" d ON d."idDocumento" = hdg."idDocumento"
    LEFT JOIN ${schema}."Persona" p ON p."idPersona" = d."idPersona"
    WHERE std."idShareTemporal" = $1
    ORDER BY std."orden" ASC, std."idShareTemporalDocumento" ASC
  `;
  const { rows } = await executor(client).query(sql, [idShareTemporal]);
  return rows;
}

async function getDocumentInShare(idShareTemporal, idHistorialDocumentoGuardado, client) {
  const sql = `
    SELECT *
    FROM ${schema}."ShareTemporalDocumento"
    WHERE "idShareTemporal" = $1
      AND "idHistorialDocumentoGuardado" = $2
    LIMIT 1
  `;
  const { rows } = await executor(client).query(sql, [idShareTemporal, idHistorialDocumentoGuardado]);
  return rows[0] || null;
}

module.exports = {
  getStateMap,
  createShare,
  updateShareFields,
  insertDocuments,
  insertAccessLog,
  getShareById,
  getShareByIdForUser,
  getShareByTokenHash,
  listSharesByUser,
  getDocumentsByShareId,
  getDocumentInShare
};
