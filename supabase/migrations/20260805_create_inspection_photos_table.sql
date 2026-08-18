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