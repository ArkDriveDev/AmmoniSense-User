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
      };
      reader.readAsDataURL(file);
    };

    input.click();
  });
};

// Convert decimal degrees to EXIF Rational format [[deg, 1], [min, 1], [sec*100, 100]]
const degToExifRational = (deg: number): [[number, number], [number, number], [number, number]] => {
  const absolute = Math.abs(deg);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = Math.floor((minutesNotTruncated - minutes) * 60 * 100);

  return [
    [degrees, 1],
    [minutes, 1],
    [seconds, 100],
  ];
};

/**
 * Draw visible watermark / metadata stamp onto canvas
 */
export const addStampToImage = (
  imageDataUrl: string,
  options: StampOptions
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to get 2D canvas context'));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;

      // Draw original photo
      ctx.drawImage(img, 0, 0);

      // Scale font and dimensions according to image size
      const scale = Math.max(1, img.width / 1000);
      const bannerHeight = 110 * scale;
      const fontSizeLarge = Math.round(20 * scale);
      const fontSizeSmall = Math.round(14 * scale);
      const padding = 16 * scale;

      // Draw Translucent Overlay Banner at bottom
      ctx.fillStyle = 'rgba(15, 23, 42, 0.82)'; // Dark slate semi-transparent
      ctx.fillRect(0, img.height - bannerHeight, img.width, bannerHeight);

      // Top accent line on banner
      ctx.fillStyle = '#3880ff'; // Primary Blue
      ctx.fillRect(0, img.height - bannerHeight, img.width, 4 * scale);

      // Text styling
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${fontSizeLarge}px sans-serif`;

      const nowStr = new Date().toLocaleString();
      const latStr = options.latitude.toFixed(6);