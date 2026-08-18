-- ============================================
-- RENAME TABLES (livestock → monitoring_sites)
-- ============================================

-- Rename livestock_owners to site_owners
ALTER TABLE IF EXISTS public.livestock_owners RENAME TO site_owners;

-- Rename livestock to monitoring_sites
ALTER TABLE IF EXISTS public.livestock RENAME TO monitoring_sites;

-- Rename livestock_locations to site_locations
ALTER TABLE IF EXISTS public.livestock_locations RENAME TO site_locations;


-- ============================================
-- RENAME COLUMNS IN MONITORING_SITES
-- ============================================

ALTER TABLE public.monitoring_sites RENAME COLUMN livestock_serial TO site_code;
ALTER TABLE public.monitoring_sites RENAME COLUMN livestock_name TO site_name;

-- Add site_type column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'monitoring_sites' AND column_name = 'site_type') THEN
    ALTER TABLE public.monitoring_sites ADD COLUMN site_type TEXT NULL;
  END IF;
END $$;

-- Rename farm_size_hectares to area_size_hectares
ALTER TABLE public.monitoring_sites RENAME COLUMN farm_size_hectares TO area_size_hectares;


-- ============================================
-- RENAME COLUMNS IN SITE_LOCATIONS
-- ============================================

ALTER TABLE public.site_locations RENAME COLUMN livestock_id TO site_id;


-- ============================================
-- RENAME COLUMNS IN DEVICES
-- ============================================

ALTER TABLE public.devices RENAME COLUMN livestock_id TO site_id;


-- ============================================
-- RENAME FOREIGN KEY CONSTRAINTS
-- ============================================

ALTER TABLE public.monitoring_sites RENAME CONSTRAINT fk_livestock_owner TO fk_monitoring_sites_owner;
ALTER TABLE public.site_locations RENAME CONSTRAINT fk_livestock_location TO fk_site_locations_site;
ALTER TABLE public.devices RENAME CONSTRAINT fk_devices_livestock TO fk_devices_site;


-- ============================================
-- RENAME INDEXES
-- ============================================

ALTER INDEX idx_livestock_location RENAME TO idx_monitoring_sites_location;
ALTER INDEX idx_livestock_grid_cell RENAME TO idx_monitoring_sites_grid_cell;
ALTER INDEX idx_livestock_locations_livestock_id RENAME TO idx_site_locations_site_id;
ALTER INDEX idx_livestock_locations_recorded_at RENAME TO idx_site_locations_recorded_at;
ALTER INDEX idx_livestock_locations_grid_cell RENAME TO idx_site_locations_grid_cell;


-- ============================================
-- RENAME TRIGGERS AND FUNCTIONS
-- ============================================

-- Drop old trigger
DROP TRIGGER IF EXISTS update_livestock_current_location_trigger ON public.site_locations;

-- Drop old function
DROP FUNCTION IF EXISTS update_livestock_current_location();

-- Create new function with updated names
CREATE OR REPLACE FUNCTION update_site_current_location()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.monitoring_sites 
  SET 
    current_latitude = NEW.latitude,
    current_longitude = NEW.longitude,
    current_grid_cell_id = NEW.grid_cell_id
  WHERE id = NEW.site_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create new trigger
CREATE TRIGGER update_site_current_location_trigger
AFTER INSERT ON public.site_locations
FOR EACH ROW
EXECUTE FUNCTION update_site_current_location();


-- ============================================
-- UPDATE RLS POLICIES (Drop old, create new)
-- ============================================

-- Drop old policies on site_owners
DROP POLICY IF EXISTS "MHO Admin full access livestock_owners" ON public.site_owners;
DROP POLICY IF EXISTS "MENRO Admin full access livestock_owners" ON public.site_owners;
DROP POLICY IF EXISTS "Inspector can view livestock_owners" ON public.site_owners;

-- Create new policies on site_owners
CREATE POLICY "MENRO Admin full access site_owners"
  ON public.site_owners FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'menro_admin'));

CREATE POLICY "Inspector can view site_owners"
  ON public.site_owners FOR SELECT
  USING (true);


-- Drop old policies on monitoring_sites
DROP POLICY IF EXISTS "MHO Admin full access livestock" ON public.monitoring_sites;
DROP POLICY IF EXISTS "MENRO Admin full access livestock" ON public.monitoring_sites;
DROP POLICY IF EXISTS "Inspector can view livestock" ON public.monitoring_sites;

-- Create new policies on monitoring_sites
CREATE POLICY "MENRO Admin full access monitoring_sites"
  ON public.monitoring_sites FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'menro_admin'));

CREATE POLICY "Inspector can view monitoring_sites"
  ON public.monitoring_sites FOR SELECT
  USING (true);


-- Drop old policies on site_locations
DROP POLICY IF EXISTS "MHO Admin full access livestock_locations" ON public.site_locations;
DROP POLICY IF EXISTS "MENRO Admin full access livestock_locations" ON public.site_locations;
DROP POLICY IF EXISTS "Inspector can view livestock_locations" ON public.site_locations;
DROP POLICY IF EXISTS "Inspector can insert livestock_locations" ON public.site_locations;

-- Create new policies on site_locations
CREATE POLICY "MENRO Admin full access site_locations"
  ON public.site_locations FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'menro_admin'));

CREATE POLICY "Inspector can view site_locations"
  ON public.site_locations FOR SELECT
  USING (true);

CREATE POLICY "Inspector can insert site_locations"
  ON public.site_locations FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'environmental_inspector'));


-- Drop old policies on devices
DROP POLICY IF EXISTS "MHO Admin full access devices" ON public.devices;
DROP POLICY IF EXISTS "MENRO Admin full access devices" ON public.devices;
DROP POLICY IF EXISTS "Inspector can view devices" ON public.devices;

-- Create new policies on devices
CREATE POLICY "MENRO Admin full access devices"
  ON public.devices FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'menro_admin'));

CREATE POLICY "Inspector can view devices"
  ON public.devices FOR SELECT
  USING (true);


-- Drop old policies on sensor_data
DROP POLICY IF EXISTS "MHO Admin full access sensor_data" ON public.sensor_data;
DROP POLICY IF EXISTS "MENRO Admin full access sensor_data" ON public.sensor_data;
DROP POLICY IF EXISTS "Inspector can view all sensor_data" ON public.sensor_data;
DROP POLICY IF EXISTS "Inspector can insert sensor_data" ON public.sensor_data;
DROP POLICY IF EXISTS "Inspector can update own sensor_data" ON public.sensor_data;