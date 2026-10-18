import offlineStorage from './OfflineStorageService';
import { CapturedSessionReading } from '../types/capture';

export async function persistCaptureReading(reading: CapturedSessionReading): Promise<void> {
  const payload = {
    session_id: reading.session_id,
    inspection_tag_temp_id: reading.inspection_tag_temp_id,
    device_uid: reading.device_uid,
    nh3_ppm: reading.nh3_ppm,
    ammonia: reading.nh3_ppm,
    temperature: reading.temperature,
    humidity: reading.humidity,
    battery_percent: reading.battery_percent,
    battery: reading.battery_percent,
    created_at: reading.created_at,
  };

  await offlineStorage.enqueueItem('sensor_data', payload, {
    tempId: reading.inspection_tag_temp_id,
    action: 'insert',
  });
}

export async function getPersistedReadingsForTag(tagTempId: string): Promise<CapturedSessionReading[]> {
  const queue = await offlineStorage.getQueue();
  return queue
    .filter((item) => item.type === 'sensor_data' && item.payload?.inspection_tag_temp_id === tagTempId)
    .map((item) => ({
      session_id: item.payload.session_id,
      inspection_tag_temp_id: item.payload.inspection_tag_temp_id,
      device_uid: item.payload.device_uid,
      nh3_ppm: item.payload.nh3_ppm ?? item.payload.ammonia ?? 0,
      temperature: item.payload.temperature ?? null,
      humidity: item.payload.humidity ?? null,
      battery_percent: item.payload.battery_percent ?? item.payload.battery ?? null,
      created_at: item.payload.created_at || item.createdAt,
    }));
}
