import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import piexif from 'piexifjs';
import { supabase } from '../services/supabase';
import { getSignedPhotoUrl, sanitizeNumericId } from '../services/photoStorageService';
import { GpsSource } from '../types/site';

export interface InspectionPhotoRecord {
  id?: number | string | null;
  photo_url: string;
  photo_thumbnail_url?: string | null;
  latitude: number;
  longitude: number;
  dataUrl?: string;
  captured_at?: string;
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
      const lngStr = options.longitude.toFixed(6);

      // Line 1: Site Name
      const line1 = `SITE: ${options.siteName || 'MENRO Site'}`;
      ctx.fillText(line1, padding, img.height - bannerHeight + padding + fontSizeLarge * 0.8);

      // Line 2: GPS Coordinates & Ammonia (if provided)
      ctx.font = `${fontSizeSmall}px monospace`;
      ctx.fillStyle = '#cbd5e1';

      let line2 = `GPS: ${latStr}°, ${lngStr}°  •  TIME: ${nowStr}`;
      if (options.ammoniaPpm !== undefined) {
        line2 += `  •  NH3: ${options.ammoniaPpm.toFixed(1)} ppm`;
      }
      ctx.fillText(line2, padding, img.height - bannerHeight + padding + fontSizeLarge + fontSizeSmall * 1.2);

      // MENRO Watermark Tag top-right
      ctx.fillStyle = 'rgba(56, 128, 255, 0.85)';
      const tagWidth = 140 * scale;
      const tagHeight = 28 * scale;
      ctx.fillRect(img.width - tagWidth - padding, padding, tagWidth, tagHeight);

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${12 * scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('MENRO AMMONISENSE', img.width - tagWidth / 2 - padding, padding + 18 * scale);

      // Return stamped image data URL
      const stampedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      resolve(stampedDataUrl);
    };

    img.onerror = (err) => reject(err);
    img.src = imageDataUrl;
  });
};

/**
 * Embed EXIF Location and Metadata into JPEG DataURL
 */
export const embedExifData = (
  imageDataUrl: string,
  options: StampOptions
): string => {
  try {
    const zeroth: Record<number, any> = {};
    const exif: Record<number, any> = {};
    const gps: Record<number, any> = {};

    // Set EXIF DateTimeOriginal
    const now = new Date();
    const dateStr = now
      .toISOString()
      .replace(/-/g, ':')
      .replace('T', ' ')
      .substring(0, 19);

    exif[piexif.ExifIFD.DateTimeOriginal] = dateStr;
    exif[piexif.ExifIFD.UserComment] = `NH3:${options.ammoniaPpm || 0}`;

    // Set GPS EXIF Data
    const latRef = options.latitude >= 0 ? 'N' : 'S';
    const lngRef = options.longitude >= 0 ? 'E' : 'W';

    gps[piexif.GPSIFD.GPSLatitudeRef] = latRef;
    gps[piexif.GPSIFD.GPSLatitude] = degToExifRational(options.latitude);
    gps[piexif.GPSIFD.GPSLongitudeRef] = lngRef;
    gps[piexif.GPSIFD.GPSLongitude] = degToExifRational(options.longitude);

    zeroth[piexif.ImageIFD.Make] = 'MENRO AmmoniSense';
    zeroth[piexif.ImageIFD.Model] = 'Capacitor Inspector Mobile';

    const exifObj = { '0th': zeroth, Exif: exif, GPS: gps };
    const exifBytes = piexif.dump(exifObj);

    return piexif.insert(exifBytes, imageDataUrl);
  } catch (err) {
    console.error('Error embedding EXIF data:', err);
    return imageDataUrl;
  }
};

/**
 * Helper to convert DataURL to Blob
 */
export const dataURLtoBlob = (dataurl: string): Blob => {
  const arr = dataurl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};

/**
 * Upload Photo Blob to Supabase Storage Bucket ('site-photos')
 */
export const uploadPhotoToSupabase = async (
  blob: Blob,
  siteId: string | number = 'general'
): Promise<string | null> => {
  try {
    const cleanSiteId = sanitizeNumericId(siteId);
    if (!cleanSiteId) return null;
    const filename = `${cleanSiteId}/site_photo.jpg`;

    const { data, error } = await supabase.storage
      .from('site-photos')
      .upload(filename, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) {
      console.warn('Storage upload notice (checking permissions/bucket):', error.message);
      return null;
    }

    return await getSignedPhotoUrl('site-photos', data.path);
  } catch (err) {
    console.error('Error uploading photo to Supabase storage:', err);
    return null;
  }
};

/**
 * STEP 1: Take Photo & Upload to Storage
 */
export const step1_takeAndUploadPhoto = async (
  siteId?: number | string,
  siteName: string = 'Inspection Site'
): Promise<InspectionPhotoRecord> => {
  // 1. Get current GPS location
  let latitude = 14.5995;
  let longitude = 120.9842;

  try {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
    });
    latitude = position.coords.latitude;
    longitude = position.coords.longitude;
  } catch (geoErr) {
    console.warn('Could not fetch device GPS location, using fallback:', geoErr);
  }

  // 2. Capture photo via Capacitor Camera (with web/unimplemented fallback)
  const capturedDataUrl = await captureImageWithCameraOrFallback();

  const stampOptions: StampOptions = {
    latitude,
    longitude,
    siteName,
  };

  // 3. Stamp visible canvas overlay
  const stampedDataUrl = await addStampToImage(capturedDataUrl, stampOptions);

  // 4. Embed EXIF GPS metadata
  const finalDataUrl = embedExifData(stampedDataUrl, stampOptions);

  // 5. Convert to Blob & Upload to Storage
  const blob = dataURLtoBlob(finalDataUrl);
  const publicUrl = await uploadPhotoToSupabase(blob, siteId || 'general');
  const photoUrlToSave = publicUrl || finalDataUrl;

  const numericSiteId = typeof siteId === 'number' && !isNaN(siteId)
    ? siteId
    : (siteId && typeof siteId === 'string' && !siteId.startsWith('temp_') && !isNaN(Number(siteId)))
      ? Number(siteId)
      : null;

  return {
    id: null,
    photo_url: photoUrlToSave,
    photo_thumbnail_url: photoUrlToSave,
    latitude,
    longitude,
    dataUrl: finalDataUrl,
    captured_at: new Date().toISOString(),
  };
};

/**
 * @deprecated inspection_photos table dropped. Photos live directly on tags & sites.
 */
export const step4_markPhotoAsUsed = async (
  _photoId: number | null | undefined,
  _sensorDataId: number
): Promise<void> => {
  // No-op: inspection_photos table is dropped
};

/**
 * Extract GPS Coordinates (Latitude, Longitude) from JPEG DataURL EXIF header
 */
export const extractGpsFromExif = (dataUrl: string): { latitude: number; longitude: number } | null => {
  try {
    const exifObj = piexif.load(dataUrl);
    const gps = exifObj?.GPS;
    if (!gps) return null;

    const latRaw = gps[piexif.GPSIFD.GPSLatitude];
    const latRef = gps[piexif.GPSIFD.GPSLatitudeRef];
    const lngRaw = gps[piexif.GPSIFD.GPSLongitude];
    const lngRef = gps[piexif.GPSIFD.GPSLongitudeRef];

    if (!latRaw || !lngRaw || !latRef || !lngRef) return null;

    const convertRationalToDeg = (rational: [[number, number], [number, number], [number, number]]): number => {
      const deg = rational[0][0] / (rational[0][1] || 1);
      const min = rational[1][0] / (rational[1][1] || 1);
      const sec = rational[2][0] / (rational[2][1] || 1);
      return deg + min / 60 + sec / 3600;
    };

    let latitude = convertRationalToDeg(latRaw);
    if (latRef === 'S') latitude = -latitude;

    let longitude = convertRationalToDeg(lngRaw);
    if (lngRef === 'W') longitude = -longitude;

    if (isNaN(latitude) || isNaN(longitude) || (latitude === 0 && longitude === 0)) {
      return null;
    }

    return { latitude, longitude };
  } catch (err) {
    console.warn('Could not parse EXIF GPS from photo data URL:', err);
    return null;
  }
};

export interface CaptureSitePhotoResult {
  photoRecord: InspectionPhotoRecord;
  dataUrl: string;
  latitude: number;
  longitude: number;
  gpsSource: GpsSource;
}

/**
 * Capture Site Photo via Capacitor Camera, extract EXIF GPS or fallback to Device GPS, stamp, upload & record
 */
export const captureSitePhoto = async (
  siteName: string = 'New Monitoring Site',
  siteId?: string | number | null
): Promise<CaptureSitePhotoResult> => {
  // 1. Capture photo via Capacitor Camera (with web/unimplemented fallback)
  const capturedDataUrl = await captureImageWithCameraOrFallback();

  // 2. Try EXIF GPS extraction from captured photo
  let gpsSource: GpsSource = 'photo_exif';
  let extracted = extractGpsFromExif(capturedDataUrl);
  let latitude = extracted?.latitude;
  let longitude = extracted?.longitude;

  // 3. Fallback to Device GPS if EXIF GPS is missing
  if (latitude === undefined || longitude === undefined) {
    gpsSource = 'device_gps';
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });
      latitude = position.coords.latitude;
      longitude = position.coords.longitude;
    } catch (geoErr) {
      console.warn('Device GPS fallback failed, using default manual coordinates:', geoErr);
      gpsSource = 'manual';
      latitude = 14.5995;
      longitude = 120.9842;
    }
  }

  const stampOptions: StampOptions = {
    latitude,
    longitude,
    siteName,
  };

  // 4. Stamp & Embed EXIF
  const stampedDataUrl = await addStampToImage(capturedDataUrl, stampOptions);
  const finalDataUrl = embedExifData(stampedDataUrl, stampOptions);

  // 5. Upload photo to Supabase Storage only if a valid siteId is known
  let publicUrl: string | null = null;
  if (siteId && siteId !== 'site_registration' && !String(siteId).startsWith('temp_')) {
    const blob = dataURLtoBlob(finalDataUrl);
    publicUrl = await uploadPhotoToSupabase(blob, siteId);
  }
  const photoUrlToSave = publicUrl || finalDataUrl;

  const photoRecord: InspectionPhotoRecord = {
    id: null,
    photo_url: photoUrlToSave,
    photo_thumbnail_url: photoUrlToSave,
    latitude,
    longitude,
    dataUrl: finalDataUrl,
    captured_at: new Date().toISOString(),
  };

  return {
    photoRecord,
    dataUrl: finalDataUrl,
    latitude,
    longitude,
    gpsSource,
  };
};
