CREATE TABLE IF NOT EXISTS marzo."EstadoShare" (
  "idEstadoShare" SERIAL PRIMARY KEY,
  "nombre" VARCHAR(50) NOT NULL UNIQUE,
  "descripcion" VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS marzo."ShareTemporal" (
  "idShareTemporal" BIGSERIAL PRIMARY KEY,
  "codigo" VARCHAR(40) NOT NULL UNIQUE,
  "shareTokenHash" VARCHAR(128) NOT NULL UNIQUE,
  "fechaCreacion" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fechaExpiracion" TIMESTAMP NOT NULL,
  "duracionMinutos" INTEGER NOT NULL,
  "idUsuarioGenerador" BIGINT NOT NULL,
  "idEstadoShare" INTEGER NOT NULL REFERENCES marzo."EstadoShare"("idEstadoShare"),
  "requierePin" BOOLEAN NOT NULL DEFAULT FALSE,
  "pinHash" VARCHAR(255),
  "permiteVisualizacion" BOOLEAN NOT NULL DEFAULT TRUE,
  "permiteDescarga" BOOLEAN NOT NULL DEFAULT TRUE,
  "descargarComoZip" BOOLEAN NOT NULL DEFAULT FALSE,
  "singleUse" BOOLEAN NOT NULL DEFAULT FALSE,
  "maxAccesos" INTEGER,
  "accesosActuales" INTEGER NOT NULL DEFAULT 0,
  "maxDescargas" INTEGER,
  "descargasActuales" INTEGER NOT NULL DEFAULT 0,
  "urlPublica" TEXT NOT NULL,
  "observaciones" TEXT
);

CREATE INDEX IF NOT EXISTS "IX_ShareTemporal_idUsuarioGenerador"
  ON marzo."ShareTemporal" ("idUsuarioGenerador");

CREATE INDEX IF NOT EXISTS "IX_ShareTemporal_fechaExpiracion"
  ON marzo."ShareTemporal" ("fechaExpiracion");

CREATE TABLE IF NOT EXISTS marzo."ShareTemporalDocumento" (
  "idShareTemporalDocumento" BIGSERIAL PRIMARY KEY,
  "idShareTemporal" BIGINT NOT NULL REFERENCES marzo."ShareTemporal"("idShareTemporal") ON DELETE CASCADE,
  "idHistorialDocumentoGuardado" BIGINT NOT NULL REFERENCES marzo."HistorialDocumentoGuardado"("idHistorialDocumentoGuardado"),
  "orden" INTEGER NOT NULL DEFAULT 1,
  "nombreSnapshot" VARCHAR(255) NOT NULL,
  "rutaSnapshot" TEXT NOT NULL,
  "pesoArchivoBytes" BIGINT,
  "mimeType" VARCHAR(150)
);

CREATE TABLE IF NOT EXISTS marzo."ShareTemporalAcceso" (
  "idShareTemporalAcceso" BIGSERIAL PRIMARY KEY,
  "idShareTemporal" BIGINT NOT NULL REFERENCES marzo."ShareTemporal"("idShareTemporal") ON DELETE CASCADE,
  "fechaAcceso" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ip" VARCHAR(100),
  "userAgent" TEXT,
  "accion" VARCHAR(50) NOT NULL,
  "resultado" VARCHAR(20) NOT NULL,
  "detalle" TEXT
);
