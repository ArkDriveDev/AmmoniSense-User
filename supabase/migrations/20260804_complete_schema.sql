-- ============================================
-- COMPLETE DATABASE SCHEMA - AMMONISENSE
-- ============================================

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL,
  full_name TEXT NULL,
  role TEXT DEFAULT 'environmental_inspector'::TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_role_check CHECK (role IN ('menro_admin', 'environmental_inspector'))
);

-- 2. LIVESTOCK_OWNERS
CREATE TABLE IF NOT EXISTS public.livestock_owners (
  id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
  owner_name TEXT NOT NULL,
  contact_number TEXT NULL,
  email TEXT NULL,
  address TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NULL,
  CONSTRAINT livestock_owners_pkey PRIMARY KEY (id),
  CONSTRAINT livestock_owners_email_key UNIQUE (email)
);

-- 3. LIVESTOCK
CREATE TABLE IF NOT EXISTS public.livestock (
  id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
  livestock_serial TEXT NOT NULL,
  livestock_name TEXT NOT NULL,
  owner_id BIGINT NOT NULL,
  current_latitude DOUBLE PRECISION NULL,
  current_longitude DOUBLE PRECISION NULL,
  current_grid_cell_id TEXT NULL,
  address TEXT NULL,
  farm_size_hectares DECIMAL(10,2) NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NULL,
  CONSTRAINT livestock_pkey PRIMARY KEY (id),
  CONSTRAINT livestock_livestock_serial_key UNIQUE (livestock_serial),
  CONSTRAINT fk_livestock_owner FOREIGN KEY (owner_id) REFERENCES livestock_owners(id) ON DELETE CASCADE
);

-- 4. LIVESTOCK_LOCATIONS
CREATE TABLE IF NOT EXISTS public.livestock_locations (
  id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
  livestock_id BIGINT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  grid_cell_id TEXT NULL,
  address TEXT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  recorded_by UUID NULL,
  notes TEXT NULL,
  CONSTRAINT livestock_locations_pkey PRIMARY KEY (id),
  CONSTRAINT fk_livestock_location FOREIGN KEY (livestock_id) REFERENCES livestock(id) ON DELETE CASCADE,
  CONSTRAINT fk_livestock_location_recorder FOREIGN KEY (recorded_by) REFERENCES profiles(id) ON DELETE SET NULL
);

-- 5. DEVICES
CREATE TABLE IF NOT EXISTS public.devices (
  id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
  device_uid TEXT NOT NULL,
  livestock_id BIGINT NOT NULL,
  firmware_version TEXT NULL,
  status TEXT DEFAULT 'ACTIVE'::TEXT,
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),