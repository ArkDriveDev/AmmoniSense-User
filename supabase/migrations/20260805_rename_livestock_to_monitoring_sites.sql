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