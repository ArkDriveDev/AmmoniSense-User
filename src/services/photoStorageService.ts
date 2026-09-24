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
  isOffline: boolean;
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
  tagRef: string | number = 'tag'
): Promise<UploadedPhotoPair> {
  const ts = Date.now();
  const pName = `tag_${tagRef}_${ts}.jpg`;
  const tName = `thumb_${tagRef}_${ts}.jpg`;

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
      return { photoUrl: pUrl, thumbnailUrl: tUrl, isOffline: false };
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
