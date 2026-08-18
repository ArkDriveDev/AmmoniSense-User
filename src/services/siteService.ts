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