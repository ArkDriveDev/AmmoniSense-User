-- ============================================
-- BLE AUTO-REGISTRATION SUPPORT
-- Makes site_id nullable (devices exist without sites)
-- Adds new device metadata columns
-- Adds RLS policies for inspector auto-registration
-- ============================================

-- 1. Make site_id nullable so devices can auto-register without a site
ALTER TABLE public.devices
  ALTER COLUMN site_id DROP NOT NULL;

-- 2. Add device_name column (human-readable label auto-generated from BLE)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'devices' AND column_name = 'device_name') THEN
    ALTER TABLE public.devices ADD COLUMN device_name TEXT NULL;
  END IF;
END $$;

-- 3. Add first_seen_at column (timestamp of initial BLE auto-registration)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'devices' AND column_name = 'first_seen_at') THEN
    ALTER TABLE public.devices ADD COLUMN first_seen_at TIMESTAMPTZ NULL;
  END IF;
END $$;

-- 4. Add last_seen_at column (updated on every BLE reconnect)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'devices' AND column_name = 'last_seen_at') THEN
    ALTER TABLE public.devices ADD COLUMN last_seen_at TIMESTAMPTZ NULL;
  END IF;
END $$;

-- 5. RLS: Allow authenticated inspectors to insert (auto-register) devices
DROP POLICY IF EXISTS "Inspector can insert devices" ON public.devices;
CREATE POLICY "Inspector can insert devices"
  ON public.devices FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 6. RLS: Allow inspectors to update their own registered devices
DROP POLICY IF EXISTS "Inspector can update own devices" ON public.devices;
CREATE POLICY "Inspector can update own devices"
  ON public.devices FOR UPDATE
  USING (created_by = auth.uid());
