# symplia-share

Microservicio Node.js para compartir documentos de forma temporal por link y/o QR, con expiración real, PIN opcional, límites de acceso/descarga y ZIP para múltiples documentos.

## Decisiones v1

- El token público real nunca se guarda en claro: en base solo va `shareTokenHash`.
- El PIN tampoco se guarda en claro: se persiste `pinHash`.
- Si el share requiere PIN, `POST /public/shares/:token/validate-pin` devuelve un `pinAccessToken` firmado y de corta vida. Ese token se envía luego por query `pinAccessToken` o header `x-share-pin-token`.
- Para obtener `idUsuarioGenerador`, el micro prioriza el header configurado en `AUTH_USER_ID_HEADER`. Si no existe, intenta claims reenviados por gateway y finalmente responde `401` si no puede resolver un id numérico.
- `singleUse=true` se interpreta como un máximo efectivo de 1 acceso público exitoso.
- Si `rutaArchivo` viene relativa, se resuelve contra `FILES_BASE_PATH`. Si viene absoluta, se usa tal cual.

## Cómo levantar

```bash
cp .env.example .env
npm install
npm run dev
```

Health:

```bash
GET http://localhost:5500/health
```

## Variables principales

- `DB_*`: conexión PostgreSQL.
- `DB_SCHEMA`: por defecto `marzo`.
- `FILES_BASE_PATH`: base física de documentos.
- `PUBLIC_BASE_URL`: base pública que usa el QR y `urlPublica`.
- `SHARE_ACCESS_SECRET`: secreto para firmar `pinAccessToken`.

## Endpoints

Privados:

- `POST /api/shares`
- `GET /api/shares`
- `GET /api/shares/:id`
- `POST /api/shares/:id/revoke`

Públicos:

- `GET /public/shares/:token`
- `POST /public/shares/:token/validate-pin`
- `GET /public/shares/:token/documents/:idHistorialDocumentoGuardado/view`
- `GET /public/shares/:token/documents/:idHistorialDocumentoGuardado/download`
- `GET /public/shares/:token/download-zip`

## Payloads de ejemplo

Crear share:

```json
{
  "documentIds": [12, 15, 18],
  "duracionMinutos": 30,
  "requierePin": true,
  "pin": "48291",
  "permiteVisualizacion": true,
  "permiteDescarga": true,
  "descargarComoZip": true,
  "singleUse": false,
  "maxAccesos": 3,
  "maxDescargas": 1,
  "observaciones": "Documentación temporal para profesional"
}
```

Validar PIN:

```json
{
  "pin": "48291"
}
```

## Uso rápido en Postman

1. Crear share por gateway: `POST http://localhost:8080/api/shares`
2. Copiar `urlPublica` de la respuesta.
3. Abrir metadata pública: `GET http://localhost:8080/public/shares/<token>`
4. Si requiere PIN: `POST http://localhost:8080/public/shares/<token>/validate-pin`
5. Usar el `pinAccessToken` en `GET /public/shares/<token>/documents/12/download?pinAccessToken=<token>`

## SQL

- [sql/001_create_share_tables.sql](/c:/Users/misam/Desktop/PROYECTO_FINAL/symplia-share/sql/001_create_share_tables.sql)
- [sql/002_seed_estado_share.sql](/c:/Users/misam/Desktop/PROYECTO_FINAL/symplia-share/sql/002_seed_estado_share.sql)
- [sql/003_alter_historial_documento_guardado.sql](/c:/Users/misam/Desktop/PROYECTO_FINAL/symplia-share/sql/003_alter_historial_documento_guardado.sql)
