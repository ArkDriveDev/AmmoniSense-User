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
  created_by UUID NULL,
  CONSTRAINT devices_pkey PRIMARY KEY (id),
  CONSTRAINT devices_device_uid_key UNIQUE (device_uid),
  CONSTRAINT fk_devices_livestock FOREIGN KEY (livestock_id) REFERENCES livestock(id) ON DELETE CASCADE
);

-- 6. SENSOR_DATA
CREATE TABLE IF NOT EXISTS public.sensor_data (
  id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
  device_uid TEXT NOT NULL,
  ammonia DOUBLE PRECISION NULL,
  temperature DOUBLE PRECISION NULL,
  humidity DOUBLE PRECISION NULL,
  battery DOUBLE PRECISION NULL,
  status TEXT NULL,
  grid_cell_id TEXT NULL,
  latitude DOUBLE PRECISION NULL,
  longitude DOUBLE PRECISION NULL,
  submitted_by UUID NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT sensor_data_pkey PRIMARY KEY (id),
  CONSTRAINT fk_sensor_data_device FOREIGN KEY (device_uid) REFERENCES devices(device_uid) ON DELETE CASCADE,
  CONSTRAINT fk_sensor_data_inspector FOREIGN KEY (submitted_by) REFERENCES profiles(id) ON DELETE SET NULL
);

-- 7. ACTIVITY_LOGS
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  profile_id UUID NULL,
  old_data JSONB NULL,
  new_data JSONB NULL,
  details JSONB NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT activity_logs_pkey PRIMARY KEY (id)
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_livestock_location ON public.livestock (current_latitude, current_longitude);
CREATE INDEX IF NOT EXISTS idx_livestock_grid_cell ON public.livestock (current_grid_cell_id);
CREATE INDEX IF NOT EXISTS idx_livestock_locations_livestock_id ON public.livestock_locations (livestock_id);
CREATE INDEX IF NOT EXISTS idx_livestock_locations_recorded_at ON public.livestock_locations (recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_livestock_locations_grid_cell ON public.livestock_locations (grid_cell_id);
CREATE INDEX IF NOT EXISTS idx_sensor_data_device_uid ON public.sensor_data (device_uid);
CREATE INDEX IF NOT EXISTS idx_sensor_data_created_at ON public.sensor_data (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sensor_data_grid_cell ON public.sensor_data (grid_cell_id);

-- TRIGGERS
CREATE OR REPLACE FUNCTION update_livestock_current_location()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.livestock 
  SET 
    current_latitude = NEW.latitude,
    current_longitude = NEW.longitude,
    current_grid_cell_id = NEW.grid_cell_id
  WHERE id = NEW.livestock_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_livestock_current_location_trigger ON public.livestock_locations;
CREATE TRIGGER update_livestock_current_location_trigger
AFTER INSERT ON public.livestock_locations
FOR EACH ROW
EXECUTE FUNCTION update_livestock_current_location();