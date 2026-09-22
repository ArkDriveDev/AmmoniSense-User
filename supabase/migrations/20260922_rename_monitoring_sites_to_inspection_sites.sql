-- =========================================================================
-- MIGRATION: Rename Monitoring Sites to Inspection Sites
-- Date: 2026-09-22
-- Description:
-- 1. Renames public.monitoring_sites to public.inspection_sites
-- 2. Renames foreign key site_id to inspection_site_id in devices, odor_zones, site_locations
-- 3. Updates foreign key constraints, indexes, triggers, and RLS policies
-- 4. Creates a backward-compatible view public.monitoring_sites
-- =========================================================================

-- 1. RENAME TABLE
ALTER TABLE IF EXISTS public.monitoring_sites RENAME TO inspection_sites;

-- 2. RENAME FOREIGN KEY COLUMNS
DO $$ 
BEGIN
  -- In devices
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'site_id') THEN
    ALTER TABLE public.devices RENAME COLUMN site_id TO inspection_site_id;
  END IF;

  -- In odor_zones
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'odor_zones' AND column_name = 'site_id') THEN
    ALTER TABLE public.odor_zones RENAME COLUMN site_id TO inspection_site_id;
  END IF;

  -- In site_locations
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_locations' AND column_name = 'site_id') THEN
    ALTER TABLE public.site_locations RENAME COLUMN site_id TO inspection_site_id;
  END IF;

  -- In inspection_photos
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inspection_photos' AND column_name = 'site_id') THEN
    ALTER TABLE public.inspection_photos RENAME COLUMN site_id TO inspection_site_id;
  END IF;
END $$;

-- 3. RENAME CONSTRAINTS (IF EXIST)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_monitoring_sites_owner') THEN
    ALTER TABLE public.inspection_sites RENAME CONSTRAINT fk_monitoring_sites_owner TO fk_inspection_sites_owner;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_devices_site') THEN
    ALTER TABLE public.devices RENAME CONSTRAINT fk_devices_site TO fk_devices_inspection_site;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_site_locations_site') THEN
    ALTER TABLE public.site_locations RENAME CONSTRAINT fk_site_locations_site TO fk_site_locations_inspection_site;
  END IF;
END $$;

-- 4. RENAME INDEXES (IF EXIST)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_monitoring_sites_location') THEN
    ALTER INDEX idx_monitoring_sites_location RENAME TO idx_inspection_sites_location;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_monitoring_sites_grid_cell') THEN
    ALTER INDEX idx_monitoring_sites_grid_cell RENAME TO idx_inspection_sites_grid_cell;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_site_locations_site_id') THEN
    ALTER INDEX idx_site_locations_site_id RENAME TO idx_site_locations_inspection_site_id;
  END IF;
END $$;

-- 5. UPDATE TRIGGER & LOCATION UPDATE FUNCTION
DROP TRIGGER IF EXISTS update_site_current_location_trigger ON public.site_locations;
DROP FUNCTION IF EXISTS update_site_current_location();

CREATE OR REPLACE FUNCTION update_inspection_site_current_location()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.inspection_sites 
  SET 
    current_latitude = NEW.latitude,
    current_longitude = NEW.longitude
  WHERE id = NEW.inspection_site_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_inspection_site_current_location_trigger
AFTER INSERT ON public.site_locations
FOR EACH ROW
EXECUTE FUNCTION update_inspection_site_current_location();

-- 6. UPDATE RLS POLICIES
DROP POLICY IF EXISTS "MENRO Admin full access monitoring_sites" ON public.inspection_sites;
DROP POLICY IF EXISTS "Inspector can view monitoring_sites" ON public.inspection_sites;
DROP POLICY IF EXISTS "MENRO Admin full access inspection_sites" ON public.inspection_sites;
DROP POLICY IF EXISTS "Inspector can view inspection_sites" ON public.inspection_sites;
DROP POLICY IF EXISTS "Inspector can insert inspection_sites" ON public.inspection_sites;
DROP POLICY IF EXISTS "Inspector can update inspection_sites" ON public.inspection_sites;

CREATE POLICY "MENRO Admin full access inspection_sites"
  ON public.inspection_sites FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'menro_admin'));

CREATE POLICY "Inspector can view inspection_sites"
  ON public.inspection_sites FOR SELECT
  USING (true);

CREATE POLICY "Inspector can insert inspection_sites"
  ON public.inspection_sites FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Inspector can update inspection_sites"
  ON public.inspection_sites FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- 7. BACKWARD COMPATIBLE VIEW
CREATE OR REPLACE VIEW public.monitoring_sites AS
  SELECT * FROM public.inspection_sites;
