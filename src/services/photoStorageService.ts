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
      const pUrl = supabase.storage.from('inspection-photos').getPublicUrl(pName).data.publicUrl;
      const tUrl = supabase.storage.from('inspection-thumbnails').getPublicUrl(tName).data.publicUrl;
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
