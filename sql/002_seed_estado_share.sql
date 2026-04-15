INSERT INTO marzo."EstadoShare" ("nombre", "descripcion")
VALUES
  ('ACTIVO', 'Share temporal activo'),
  ('EXPIRADO', 'Share vencido por fecha u hora'),
  ('REVOCADO', 'Share revocado manualmente'),
  ('CONSUMIDO', 'Share consumido por limite de uso')
ON CONFLICT ("nombre") DO NOTHING;
