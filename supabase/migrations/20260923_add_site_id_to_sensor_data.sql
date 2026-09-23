-- =========================================================================
-- MIGRATION: Add inspection_site_id to sensor_data
-- Date: 2026-09-23
-- Description:
--   Links each sensor reading to the inspection site it was taken at.
--   This enables proper cascade cleanup when a site is deleted and
--   prevents orphan readings from appearing on the spatial map.
-- =========================================================================

-- 1. Add inspection_site_id column (nullable, SET NULL on site delete)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sensor_data' AND column_name = 'inspection_site_id'
  ) THEN
    ALTER TABLE public.sensor_data
      ADD COLUMN inspection_site_id BIGINT NULL
        REFERENCES public.inspection_sites(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Index for fast site-based filtering and cleanup
CREATE INDEX IF NOT EXISTS idx_sensor_data_inspection_site_id
  ON public.sensor_data (inspection_site_id);

-- 3. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
