const pool = require('../config/database');
const { db } = require('../config/env');

const schema = db.schema;

async function getDocumentsByIds(ids, client) {
  const executor = client || pool;
  const sql = `
    SELECT
      "idHistorialDocumentoGuardado",
      "nombreArchivo",
      "nombreArchivoFisico",
      "rutaArchivo",
      "tamanoArchivo"
    FROM ${schema}."HistorialDocumentoGuardado"
    WHERE "idHistorialDocumentoGuardado" = ANY($1::bigint[])
    ORDER BY "idHistorialDocumentoGuardado" ASC
  `;

  const { rows } = await executor.query(sql, [ids]);
  return rows;
}

module.exports = {
  getDocumentsByIds
};
