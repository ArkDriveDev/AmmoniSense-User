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