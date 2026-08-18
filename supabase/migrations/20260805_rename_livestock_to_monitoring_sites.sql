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