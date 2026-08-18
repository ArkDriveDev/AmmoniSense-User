-- ============================================
-- MIGRATION: ADD IS_SITE_PHOTO & SITE_PHOTO_ID
-- ============================================

-- 1. Add is_site_photo boolean flag to inspection_photos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inspection_photos' AND column_name = 'is_site_photo'
  ) THEN
    ALTER TABLE public.inspection_photos ADD COLUMN is_site_photo BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

-- 2. Add site_photo_id reference column to monitoring_sites
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'monitoring_sites' AND column_name = 'site_photo_id'
  ) THEN
    ALTER TABLE public.monitoring_sites ADD COLUMN site_photo_id BIGINT NULL;
  END IF;
END $$;

-- 3. Add Foreign Key constraint for site_photo_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_monitoring_sites_site_photo'
  ) THEN
    ALTER TABLE public.monitoring_sites 
      ADD CONSTRAINT fk_monitoring_sites_site_photo 
      FOREIGN KEY (site_photo_id) REFERENCES public.inspection_photos(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Create index for fast lookup of site photos
CREATE INDEX IF NOT EXISTS idx_inspection_photos_is_site_photo ON public.inspection_photos (is_site_photo);
