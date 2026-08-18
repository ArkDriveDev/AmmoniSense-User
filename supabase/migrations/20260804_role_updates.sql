-- Migration: Update user roles to MENRO Admin and Environmental Inspector
-- Context: Ammonisense Environmental Monitoring System

-- 1. Update profiles table constraint & existing records
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

UPDATE public.profiles 
SET role = 'menro_admin' 
WHERE role IN ('mho_admin', 'admin', 'superadmin');

UPDATE public.profiles 
SET role = 'environmental_inspector' 
WHERE role IN ('sanitary_inspector', 'inspector', 'client', 'farmer');

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_role_check CHECK (role IN ('menro_admin', 'environmental_inspector'));

-- 2. RLS Policies update for MENRO Admin and Environmental Inspector

-- Profiles policy
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
CREATE POLICY "Allow authenticated users to read profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Livestock / Piggeries policy for MENRO Admin
DROP POLICY IF EXISTS "MHO Admin full access livestock" ON public.livestock;
CREATE POLICY "MENRO Admin full access livestock"
  ON public.livestock FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'menro_admin'