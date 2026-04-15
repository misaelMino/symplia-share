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

### Variables del share

- `FILES_BASE_PATH=C:/Users/misam/Desktop/docs`
  Es la carpeta física donde están guardados los archivos reales. `symplia-share` usa esta base para resolver `rutaArchivo` cuando viene relativa.
  No es una variable del front.
  Hoy puede apuntar a una carpeta local; más adelante puede cambiarse a una carpeta montada en un VPS o en otra máquina sin tocar el código.

- `PUBLIC_BASE_URL=http://localhost:8080`
  Es la URL pública base con la que el micro arma `urlPublica` y el contenido del QR.
  En desarrollo normalmente apunta al gateway.
  No es una variable del front; es del microservicio.

- `SHARE_TOKEN_LENGTH=48`
  Define el largo del token público aleatorio que va dentro del link del share.
  Mientras más largo, más difícil de adivinar.
  No afecta al front.

- `DEFAULT_PIN_LENGTH=5`
  Define el mínimo de caracteres exigidos para el PIN cuando `requierePin=true`.
  Si querés más seguridad, se puede subir.

- `PIN_ACCESS_TOKEN_TTL_MINUTES=30`
  Tiempo de vida del token temporal que se entrega después de validar correctamente el PIN.
  Ese token permite acceder al share protegido sin reenviar el PIN en cada request.

- `SHARE_ACCESS_SECRET=cambiar-por-un-secreto-largo-y-unico`
  Se usa para firmar el `pinAccessToken`.
  Tiene que ser un valor largo, privado y distinto por ambiente.
  No debe exponerse en frontend ni en repositorio público.

### Variables de integración con el gateway

- `AUTH_USER_ID_HEADER=x-user-id`
  Le dice a `symplia-share` en qué header esperar el `idUsuario` numérico del usuario autenticado.
  Ejemplo: el gateway puede reenviar `x-user-id: 25`.
  No lo manda manualmente el front.

- `AUTH_USER_SUB_HEADER=x-auth-user-sub`
  Le dice al micro en qué header puede llegar el `sub` del JWT, por ejemplo `auth0|abc123`.
  Sirve como contexto de identidad, pero el campo principal para guardar `idUsuarioGenerador` es el `idUsuario` numérico.
  Tampoco lo manda manualmente el front.

- `AUTH_USER_ID_CLAIMS=https://symplia.app/idUsuario,idUsuario,user_id`
  Si el gateway no manda `x-user-id`, el micro intenta resolver el `idUsuario` buscando estos claims dentro del payload del usuario reenviado por el gateway.
  Se prueban en orden hasta encontrar uno válido.
  Esto existe para que la integración sea más flexible con distintos formatos de JWT o claims custom.

Resumen práctico:

- Front: normalmente solo manda `Authorization: Bearer ...`.
- Gateway: valida el JWT y reenvía headers/claims útiles al micro.
- `symplia-share`: usa esas variables para saber dónde leer la identidad del usuario autenticado.

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
