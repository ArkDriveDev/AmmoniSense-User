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