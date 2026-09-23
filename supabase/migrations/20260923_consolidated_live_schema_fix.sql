-- =========================================================================
-- MIGRATION: Apply All Pending Schema Fixes (Consolidated)
-- Date: 2026-09-23
-- Run this in Supabase Dashboard → SQL Editor
-- =========================================================================

-- ── 1. SITE_OWNERS: Add email column ─────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'site_owners' AND column_name = 'email'
  ) THEN
    ALTER TABLE public.site_owners ADD COLUMN email TEXT NULL;
  END IF;
END $$;

DROP POLICY IF EXISTS "Inspector can insert site_owners" ON public.site_owners;
CREATE POLICY "Inspector can insert site_owners"
  ON public.site_owners FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Inspector can update site_owners" ON public.site_owners;
CREATE POLICY "Inspector can update site_owners"
  ON public.site_owners FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- ── 2. INSPECTION_PHOTOS: Add uploaded_by & uploaded_at columns ──────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inspection_photos' AND column_name = 'uploaded_by'
  ) THEN
    ALTER TABLE public.inspection_photos
      ADD COLUMN uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inspection_photos' AND column_name = 'uploaded_at'
  ) THEN
    ALTER TABLE public.inspection_photos
      ADD COLUMN uploaded_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

DROP POLICY IF EXISTS "Inspector can insert inspection_photos" ON public.inspection_photos;
CREATE POLICY "Inspector can insert inspection_photos"
  ON public.inspection_photos FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Inspector can update own inspection_photos" ON public.inspection_photos;
CREATE POLICY "Inspector can update own inspection_photos"
  ON public.inspection_photos FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- ── 3. DEVICES: Make inspection_site_id nullable + add BLE columns ────────
DO $$
BEGIN
  -- Make inspection_site_id nullable so BLE devices can auto-register without a site
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'devices' AND column_name = 'inspection_site_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.devices ALTER COLUMN inspection_site_id DROP NOT NULL;
  END IF;

  -- Legacy: make site_id nullable too if it still exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'devices' AND column_name = 'site_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.devices ALTER COLUMN site_id DROP NOT NULL;
  END IF;

  -- Add device_name if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'devices' AND column_name = 'device_name'
  ) THEN
    ALTER TABLE public.devices ADD COLUMN device_name TEXT NULL;
  END IF;

  -- Add first_seen_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'devices' AND column_name = 'first_seen_at'
  ) THEN
    ALTER TABLE public.devices ADD COLUMN first_seen_at TIMESTAMPTZ NULL;
  END IF;

  -- Add last_seen_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'devices' AND column_name = 'last_seen_at'
  ) THEN
    ALTER TABLE public.devices ADD COLUMN last_seen_at TIMESTAMPTZ NULL;
  END IF;
END $$;

DROP POLICY IF EXISTS "Inspector can insert devices" ON public.devices;
CREATE POLICY "Inspector can insert devices"
  ON public.devices FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Inspector can update own devices" ON public.devices;
CREATE POLICY "Inspector can update own devices"
  ON public.devices FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Seed default device so FK in sensor_data never fails
INSERT INTO public.devices (device_uid, device_name, status)
VALUES ('ESP32-AMMONIA-NODE-01', 'Default Ammonia Sensor Node 01', 'ACTIVE')
ON CONFLICT (device_uid) DO NOTHING;

-- ── 4. SENSOR_DATA: Add inspection_site_id FK column ──────────────────────
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

CREATE INDEX IF NOT EXISTS idx_sensor_data_inspection_site_id
  ON public.sensor_data (inspection_site_id);

-- ── 5. STORAGE: Create 'sensor-photos' bucket ─────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('sensor-photos', 'sensor-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public sensor photos access" ON storage.objects;
CREATE POLICY "Public sensor photos access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'sensor-photos');

DROP POLICY IF EXISTS "Authenticated users can upload sensor photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload sensor photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'sensor-photos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update sensor photos" ON storage.objects;
CREATE POLICY "Authenticated users can update sensor photos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'sensor-photos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete sensor photos" ON storage.objects;
CREATE POLICY "Authenticated users can delete sensor photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'sensor-photos' AND auth.role() = 'authenticated');

-- ── 6. RELOAD SCHEMA CACHE ────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
