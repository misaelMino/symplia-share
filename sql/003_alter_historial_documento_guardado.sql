DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'marzo'
      AND table_name = 'HistorialDocumentoGuardado'
      AND column_name = 'urlArchivo'
  ) THEN
    ALTER TABLE marzo."HistorialDocumentoGuardado"
      RENAME COLUMN "urlArchivo" TO "rutaArchivo";
  END IF;
END $$;

ALTER TABLE marzo."HistorialDocumentoGuardado"
  ADD COLUMN IF NOT EXISTS "nombreArchivoFisico" VARCHAR(255);
