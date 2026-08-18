import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import piexif from 'piexifjs';
import { supabase } from '../services/supabase';
import { GpsSource } from '../types/site';

export interface InspectionPhotoRecord {
  id: number;
  photo_url: string;
  latitude: number;
  longitude: number;
  site_id: number | null;
  is_used: boolean;
  is_site_photo?: boolean;
  sensor_data_id: number | null;
  uploaded_by: string | null;
  uploaded_at: string;
  dataUrl?: string;
}

export interface StampOptions {
  latitude: number;
  longitude: number;
  ammoniaPpm?: number;
  siteName?: string;
}

/**
 * Capture photo via Capacitor Camera plugin with automatic HTML5 fallback if plugin is unimplemented
 */
export const captureImageWithCameraOrFallback = async (): Promise<string> => {
  try {
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
    });
    if (photo?.dataUrl) return photo.dataUrl;
  } catch (err: any) {
    const errMessage = (err?.message || String(err)).toLowerCase();
    if (errMessage.includes('cancel') || errMessage.includes('user cancelled')) {
      throw new Error('User cancelled photo capture');
    }
    console.warn('Capacitor Camera plugin unimplemented or PWA camera error, invoking HTML5 camera capture fallback:', err);
  }

  // Fallback: HTML5 Input File with capture="environment"
  return new Promise<string>((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'environment');
    input.style.display = 'none';
    document.body.appendChild(input);

    input.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) {
        if (document.body.contains(input)) document.body.removeChild(input);
        return reject(new Error('User cancelled camera capture'));
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (document.body.contains(input)) document.body.removeChild(input);
        resolve(event.target?.result as string);
      };
      reader.onerror = (error) => {
        if (document.body.contains(input)) document.body.removeChild(input);
        reject(error);