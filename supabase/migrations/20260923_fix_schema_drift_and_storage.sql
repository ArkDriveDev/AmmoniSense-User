-- =========================================================================
-- MIGRATION: Fix Schema Drift, Storage Bucket, and Device Foreign Keys
-- Date: 2026-09-23
-- Description:
-- 1. Adds email column and RLS insert policy to site_owners
-- 2. Adds uploaded_by and uploaded_at columns to inspection_photos
-- 3. Adds BLE auto-registration columns & RLS to devices
-- 4. Creates public storage bucket 'sensor-photos' with access policies
-- 5. Seeds default sensor node to prevent foreign key errors on sensor_data
-- =========================================================================

-- 1. SITE_OWNERS: Add missing email column & policies
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

-- 2. INSPECTION_PHOTOS: Add missing uploaded_by & uploaded_at columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inspection_photos' AND column_name = 'uploaded_by'
  ) THEN
    ALTER TABLE public.inspection_photos ADD COLUMN uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inspection_photos' AND column_name = 'uploaded_at'
  ) THEN
    ALTER TABLE public.inspection_photos ADD COLUMN uploaded_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

DROP POLICY IF EXISTS "Inspector can insert inspection_photos" ON public.inspection_photos;
CREATE POLICY "Inspector can insert inspection_photos"
  ON public.inspection_photos FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 3. DEVICES: Add missing columns, relax constraints & policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'device_name') THEN
    ALTER TABLE public.devices ADD COLUMN device_name TEXT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'first_seen_at') THEN
    ALTER TABLE public.devices ADD COLUMN first_seen_at TIMESTAMPTZ NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'last_seen_at') THEN
    ALTER TABLE public.devices ADD COLUMN last_seen_at TIMESTAMPTZ NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'inspection_site_id') THEN
    ALTER TABLE public.devices ALTER COLUMN inspection_site_id DROP NOT NULL;
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

-- Seed default device node so sensor_data foreign key doesn't fail
INSERT INTO public.devices (device_uid, device_name, status)
VALUES ('ESP32-AMMONIA-NODE-01', 'Default Ammonia Sensor Node 01', 'ACTIVE')
ON CONFLICT (device_uid) DO NOTHING;

-- 4. STORAGE: Create 'sensor-photos' bucket and access policies
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

-- 5. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
