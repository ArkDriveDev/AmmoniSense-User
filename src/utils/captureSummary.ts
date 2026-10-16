import { CapturedSessionReading, CaptureSummary } from '../types/capture';

export function computeCaptureSummary(
  readings: CapturedSessionReading[],
  sessionId: string,
  tagTempId: string
): CaptureSummary {
  if (readings.length === 0) {
    return {
      session_id: sessionId,
      inspection_tag_temp_id: tagTempId,
      total_readings: 0,
      max_ppm: 0,
      avg_ppm: 0,
      min_ppm: 0,
      readings: [],
    };
  }

  const ppms = readings.map((r) => r.nh3_ppm);
  const max_ppm = Number(Math.max(...ppms).toFixed(2));
  const min_ppm = Number(Math.min(...ppms).toFixed(2));
  const avg_ppm = Number((ppms.reduce((a, b) => a + b, 0) / ppms.length).toFixed(2));

  return {
    session_id: sessionId,
    inspection_tag_temp_id: tagTempId,
    total_readings: readings.length,
    max_ppm,
    avg_ppm,
    min_ppm,
    readings,
  };
}
