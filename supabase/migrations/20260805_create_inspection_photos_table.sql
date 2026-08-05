-- ============================================
-- CREATE TABLE: INSPECTION_PHOTOS
-- Tracks pre-submission inspection photos & location before linking to sensor_data
-- ============================================

CREATE TABLE IF NOT EXISTS public.inspection_photos (
  id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
  photo_url TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  grid_cell_id TEXT NULL,
  site_id BIGINT NULL REFERENCES public.monitoring_sites(id) ON DELETE SET NULL,
  is_used BOOLEAN NOT NULL DEFAULT FALSE,
  sensor_data_id BIGINT NULL REFERENCES public.sensor_data(id) ON DELETE SET NULL,
  uploaded_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT inspection_photos_pkey PRIMARY KEY (id)
);

-- Index for fast lookup of pending photos
CREATE INDEX IF NOT EXISTS idx_inspection_photos_is_used ON public.inspection_photos (is_used);
CREATE INDEX IF NOT EXISTS idx_inspection_photos_uploaded_by ON public.inspection_photos (uploaded_by);

-- ============================================
-- ADD FK AND PHOTO LINK COLUMNS TO SENSOR_DATA
-- ============================================

ALTER TABLE public.sensor_data ADD COLUMN IF NOT EXISTS inspection_photo_id BIGINT NULL;
ALTER TABLE public.sensor_data ADD COLUMN IF NOT EXISTS photo_url TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_sensor_data_inspection_photo'
  ) THEN
    ALTER TABLE public.sensor_data 
      ADD CONSTRAINT fk_sensor_data_inspection_photo 
      FOREIGN KEY (inspection_photo_id) REFERENCES public.inspection_photos(id) ON DELETE SET NULL;
  END IF;
END $$;


-- ============================================
-- RLS POLICIES FOR INSPECTION_PHOTOS
-- ============================================

ALTER TABLE public.inspection_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "MENRO Admin full access inspection_photos" ON public.inspection_photos;
CREATE POLICY "MENRO Admin full access inspection_photos"
  ON public.inspection_photos FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'menro_admin'));

DROP POLICY IF EXISTS "Inspector can view inspection_photos" ON public.inspection_photos;
CREATE POLICY "Inspector can view inspection_photos"
  ON public.inspection_photos FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Inspector can insert inspection_photos" ON public.inspection_photos;
CREATE POLICY "Inspector can insert inspection_photos"
  ON public.inspection_photos FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'environmental_inspector'));

DROP POLICY IF EXISTS "Inspector can update own inspection_photos" ON public.inspection_photos;
CREATE POLICY "Inspector can update own inspection_photos"
  ON public.inspection_photos FOR UPDATE
  USING (uploaded_by = auth.uid());
