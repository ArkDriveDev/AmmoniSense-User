import { supabase } from './supabase';
import { CreateSitePayload, SiteRegistrationResult, OdorZone, CommunityPolygon } from '../types/site';
import offlineStorage from './OfflineStorageService';

/**
 * Register Monitoring Site with photo & GPS without grid cells.
 */
export const registerSiteWithPhoto = async (
  payload: CreateSitePayload
): Promise<SiteRegistrationResult> => {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error('User authentication required');

  let createdOwner: any = null;
  let createdSite: any = null;
  let createdLocation: any = null;
  let photoRecord: any = null;

  try {
    // 1. Get or upsert site_owner by email
    const ownerEmail = payload.owner_email || user.email || `inspector_${user.id.slice(0, 6)}@menro.gov.ph`;
    const ownerName = payload.owner_name || user.user_metadata?.full_name || user.email || 'Inspector Owner';

    const { data: existingOwners } = await supabase
      .from('site_owners')
      .select('*')
      .eq('email', ownerEmail);

    if (existingOwners && existingOwners.length > 0) {
      createdOwner = existingOwners[0];
    } else {
      const { data: newOwner, error: ownerErr } = await supabase
        .from('site_owners')
        .insert([
          {
            owner_name: ownerName,
            email: ownerEmail,
            created_by: user.id,
          },
        ])
        .select('*')
        .single();

      if (ownerErr || !newOwner) {
        throw new Error('Failed to create site owner record: ' + (ownerErr?.message || 'Error'));
      }
      createdOwner = newOwner;
    }

    // 2. Insert into monitoring_sites (no grid cells)
    const sitePayload = {
      site_code: payload.site_code,
      site_name: payload.site_name,
      site_type: payload.site_type,
      owner_id: createdOwner.id,
      current_latitude: payload.latitude,
      current_longitude: payload.longitude,
      address: payload.address || payload.site_name,
      area_size_hectares: payload.area_size_hectares || 1.0,
      notes: payload.notes || null,
      created_by: user.id,
      updated_by: user.id,
      is_active: true,
    };

    const { data: newSite, error: siteErr } = await supabase
      .from('monitoring_sites')
      .insert([sitePayload])
      .select('*')