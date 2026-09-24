import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { supabase } from './supabase';
import offlineStorage from './OfflineStorageService';
import { createThumbnail, dataUrlToBlob } from '../utils/thumbnailUtils';

export interface PhotoCaptureResult {
  dataUrl: string;
  thumbnailDataUrl: string;
}

export interface UploadedPhotoPair {
  photoUrl: string;
  thumbnailUrl: string;
  photoStoreId?: string;
  photo_storage_path?: string;
  photo_thumbnail_storage_path?: string;
  isOffline: boolean;
}

export interface UploadedSitePhoto {
  site_photo_url: string | null;
  site_photo_thumbnail: string | null;
  site_photo_storage_path: string | null;
  site_photo_thumbnail_storage_path: string | null;
}

export interface UploadedTagPhoto {
  photo_url: string | null;
  photo_thumbnail_url: string | null;
  photo_storage_path: string | null;
  photo_thumbnail_storage_path: string | null;
}

export async function captureInspectionPhoto(): Promise<PhotoCaptureResult | null> {
  try {
    const photo = await Camera.getPhoto({
      quality: 85,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
    });
    if (!photo.dataUrl) return null;
    const thumbnailDataUrl = await createThumbnail(photo.dataUrl);
    return { dataUrl: photo.dataUrl, thumbnailDataUrl };
  } catch (err) {
    console.warn('[photoStorageService] Camera capture cancelled or failed:', err);
    return null;
  }
}

export async function getSignedPhotoUrl(
  bucket: string,
  path: string,
  expiresIn = 3600
): Promise<string | null> {
  try {
    const cleanPath = extractStoragePath(path, bucket);
    if (!cleanPath) return null;
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(cleanPath, expiresIn);
    if (error) {
      console.warn(`[photoStorageService] Failed to create signed URL for ${bucket}/${cleanPath}:`, error.message);
      return null;
    }
    return data.signedUrl;
  } catch (err) {
    console.warn(`[photoStorageService] getSignedPhotoUrl exception:`, err);
    return null;
  }
}

export function extractStoragePath(urlOrPath: string, bucket: string): string {
  if (!urlOrPath) return '';
  if (urlOrPath.startsWith('data:') || urlOrPath.startsWith('blob:')) return urlOrPath;

  const publicPrefix = `/storage/v1/object/public/${bucket}/`;
  const signPrefix = `/storage/v1/object/sign/${bucket}/`;

  const publicIdx = urlOrPath.indexOf(publicPrefix);
  if (publicIdx !== -1) {
    return decodeURIComponent(urlOrPath.substring(publicIdx + publicPrefix.length));
  }

  const signIdx = urlOrPath.indexOf(signPrefix);
  if (signIdx !== -1) {
    const afterSign = urlOrPath.substring(signIdx + signPrefix.length);
    const qIdx = afterSign.indexOf('?');
    const cleanPath = qIdx !== -1 ? afterSign.substring(0, qIdx) : afterSign;
    return decodeURIComponent(cleanPath);
  }

  return urlOrPath;
}

export async function uploadPhotoPair(
  dataUrl: string,
  thumbnailDataUrl: string,
  tagRef: string | number = 'tag',
  siteId: string | number = 'general'
): Promise<UploadedPhotoPair> {
  // Fixed filenames — upsert replaces the old file automatically
  const pName = `${siteId}/tags/${tagRef}/photo.jpg`;
  const tName = `${siteId}/tags/${tagRef}/photo_thumb.jpg`;

  try {
    const photoBlob = dataUrlToBlob(dataUrl);
    const thumbBlob = dataUrlToBlob(thumbnailDataUrl);

    const [pRes, tRes] = await Promise.all([
      supabase.storage.from('inspection-photos').upload(pName, photoBlob, {
        contentType: 'image/jpeg',
        upsert: true,
      }),
      supabase.storage.from('inspection-thumbnails').upload(tName, thumbBlob, {
        contentType: 'image/jpeg',
        upsert: true,
      }),
    ]);

    if (!pRes.error && !tRes.error) {
      const pUrl = (await getSignedPhotoUrl('inspection-photos', pName)) || pName;
      const tUrl = (await getSignedPhotoUrl('inspection-thumbnails', tName)) || tName;
      return {
        photoUrl: pUrl,
        thumbnailUrl: tUrl,
        photo_storage_path: pName,
        photo_thumbnail_storage_path: tName,
        isOffline: false,
      };
    }
  } catch (e) {
    console.warn('[photoStorageService] Storage upload failed, fallback offline:', e);
  }

  const photoStoreId = await offlineStorage.savePhoto(dataUrl);
  return {
    photoUrl: dataUrl,
    thumbnailUrl: thumbnailDataUrl,
    photoStoreId,
    isOffline: true,
  };
}

/**
 * Upload a site photo (full + thumbnail) to the 'site-photos' bucket.
 * Uses a FIXED filename so re-uploading always replaces the previous file.
 * Path: `${siteId}/site_photo.jpg`  /  `${siteId}/site_photo_thumb.jpg`
 */
export async function uploadSitePhoto(
  blob: Blob,
  thumbnailBlob: Blob | null,
  siteId: string | number = 'general'
): Promise<UploadedSitePhoto> {
  const path = `${siteId}/site_photo.jpg`;
  const thumbPath = `${siteId}/site_photo_thumb.jpg`;

  const { error: upErr } = await supabase.storage
    .from('site-photos')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (upErr) throw new Error('[photoStorageService] Site photo upload failed: ' + upErr.message);

  let thumbStorePath: string | null = null;
  if (thumbnailBlob) {
    const { error: thErr } = await supabase.storage
      .from('site-photos')
      .upload(thumbPath, thumbnailBlob, { contentType: 'image/jpeg', upsert: true });
    if (!thErr) thumbStorePath = thumbPath;
    else console.warn('[photoStorageService] Site thumbnail upload failed:', thErr.message);
  }

  const expiresIn = 60 * 60 * 24 * 365; // 1 year
  const photoUrl = await getSignedPhotoUrl('site-photos', path, expiresIn);
  const thumbUrl = thumbStorePath
    ? await getSignedPhotoUrl('site-photos', thumbStorePath, expiresIn)
    : photoUrl;

  return {
    site_photo_url: photoUrl,
    site_photo_thumbnail: thumbUrl,
    site_photo_storage_path: path,
    site_photo_thumbnail_storage_path: thumbStorePath ?? path,
  };
}

/**
 * Upload a tag photo (full + thumbnail) to the inspection-photos / inspection-thumbnails buckets.
 * Uses FIXED filenames so re-uploading always replaces the previous file.
 * Path: `${siteId}/tags/${tagId}/photo.jpg`  /  `${siteId}/tags/${tagId}/photo_thumb.jpg`
 */
export async function uploadTagPhoto(
  blob: Blob,
  thumbnailBlob: Blob | null,
  tagId: string | number,
  siteId: string | number = 'general'
): Promise<UploadedTagPhoto> {
  const path = `${siteId}/tags/${tagId}/photo.jpg`;
  const thumbPath = `${siteId}/tags/${tagId}/photo_thumb.jpg`;

  const { error: upErr } = await supabase.storage
    .from('inspection-photos')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (upErr) throw new Error('[photoStorageService] Tag photo upload failed: ' + upErr.message);

  let thumbStorePath: string | null = null;
  if (thumbnailBlob) {
    const { error: thErr } = await supabase.storage
      .from('inspection-thumbnails')
      .upload(thumbPath, thumbnailBlob, { contentType: 'image/jpeg', upsert: true });
    if (!thErr) thumbStorePath = thumbPath;
    else console.warn('[photoStorageService] Tag thumbnail upload failed:', thErr.message);
  }

  const expiresIn = 60 * 60 * 24 * 365;
  const photoUrl = await getSignedPhotoUrl('inspection-photos', path, expiresIn);
  const thumbUrl = thumbStorePath
    ? await getSignedPhotoUrl('inspection-thumbnails', thumbStorePath, expiresIn)
    : photoUrl;

  return {
    photo_url: photoUrl,
    photo_thumbnail_url: thumbUrl,
    photo_storage_path: path,
    photo_thumbnail_storage_path: thumbStorePath ?? path,
  };
}

/**
 * Delete one or more files from a Supabase Storage bucket.
 * Silently ignores missing files — best-effort cleanup.
 */
export async function deleteStorageFiles(
  bucket: string,
  paths: (string | null | undefined)[]
): Promise<void> {
  const valid = paths.filter((p): p is string => !!p && !p.startsWith('data:') && !p.startsWith('blob:') && !p.startsWith('http'));
  if (valid.length === 0) return;
  try {
    const { error } = await supabase.storage.from(bucket).remove(valid);
    if (error) console.warn(`[photoStorageService] Storage delete notice (${bucket}):`, error.message);
  } catch (err) {
    console.warn(`[photoStorageService] deleteStorageFiles exception (${bucket}):`, err);
  }
}
