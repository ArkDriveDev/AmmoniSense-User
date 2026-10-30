import { AmmoniSenseReading } from '../types/schema';

/**
 * Values treated as invalid / error / unavailable
 */
const INVALID_VALUE_REGEX = /^(ERROR|INVALID|NOT CALIBRATED|UNAVAILABLE|NAN|NULL)$/i;

/**
 * Extracts a numeric floating-point value from a string (e.g. "31.3 C", "620 mV", "38.0k", "1.04 V").
 * Returns null if the value is invalid or cannot be parsed.
 */
function extractNumber(valStr: string): number | null {
  if (!valStr) return null;
  const trimmed = valStr.trim();
  if (INVALID_VALUE_REGEX.test(trimmed)) return null;

  // Match optional negative sign, digits, optional decimal point
  const match = trimmed.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;

  const num = parseFloat(match[0]);
  return isNaN(num) ? null : num;
}

/**
 * Parses a single line emitted by the ESP32 firmware over Classic Bluetooth Serial (SPP).
 *
 * Example firmware line:
 * "Temp: 31.3 C | Hum: 68.0 % | MQ pin: 620 mV | AO: 1.04 V | Rs: 38.0k | R0: 11.87k | Rs/R0: 3.61 | NH3 estimate: 0.00 ppm | Battery: 23% (3.74 V) | [PPM UNVERIFIED]"
 */
export function parseAmmoniSenseLine(line: string): AmmoniSenseReading | null {
  if (!line || typeof line !== 'string') return null;

  const trimmedLine = line.trim();
  if (!trimmedLine) return null;

  // Fast check: Must contain key indicators of sensor stream
  const lowerLine = trimmedLine.toLowerCase();
  if (!lowerLine.includes('temp') && !lowerLine.includes('nh3') && !lowerLine.includes('ammonia') && !lowerLine.includes('ppm')) {
    return null;
  }

  const ppmUnverified = trimmedLine.includes('[PPM UNVERIFIED]');

  const reading: AmmoniSenseReading = {
    temperature: null,
    humidity: null,
    mqPin_mV: null,
    mqAO_V: null,
    rs_kOhm: null,
    r0_kOhm: null,
    ratio: null,
    nh3_ppm: null,
    battery_percent: null,
    battery_voltage: null,
    ppm_unverified: ppmUnverified,
    raw_line: trimmedLine,
    timestamp: new Date().toISOString(),
  };

  const segments = trimmedLine.split('|').map((s) => s.trim());

  for (const segment of segments) {
    if (!segment || segment.startsWith('[')) continue;

    const colonIdx = segment.indexOf(':');
    if (colonIdx === -1) continue;

    const key = segment.substring(0, colonIdx).trim().toLowerCase();
    const val = segment.substring(colonIdx + 1).trim();

    switch (key) {
      case 'temp':
        reading.temperature = extractNumber(val);
        break;

      case 'hum':
        reading.humidity = extractNumber(val);
        break;

      case 'mq pin':
        reading.mqPin_mV = extractNumber(val);
        break;

      case 'ao':
        reading.mqAO_V = extractNumber(val);
        break;

      case 'rs':
        reading.rs_kOhm = extractNumber(val);
        break;

      case 'r0':
        reading.r0_kOhm = extractNumber(val);
        break;

      case 'rs/r0':
        reading.ratio = extractNumber(val);
        break;

      case 'nh3 estimate':
      case 'nh3':
      case 'nh3 ppm':
      case 'ammonia':
      case 'ammonia ppm':
      case 'ppm':
        reading.nh3_ppm = extractNumber(val);
        break;

      case 'battery': {
        if (!INVALID_VALUE_REGEX.test(val)) {
          // Battery format: "23% (3.74 V)"
          const percentMatch = val.match(/(\d+(?:\.\d+)?)\s*%/);
          if (percentMatch) {
            const pct = parseFloat(percentMatch[1]);
            reading.battery_percent = isNaN(pct) ? null : Math.round(pct);
          }

          const voltMatch = val.match(/\((\d+(?:\.\d+)?)\s*V\)/i);
          if (voltMatch) {
            const v = parseFloat(voltMatch[1]);
            reading.battery_voltage = isNaN(v) ? null : v;
          }
        }
        break;
      }

      default:
        break;
    }
  }

  if (reading.nh3_ppm === null) {
    const fallbackMatch = trimmedLine.match(/(?:nh3(?:\s*estimate)?|ammonia)\s*[:=]\s*(-?\d+(?:\.\d+)?)/i)
      || trimmedLine.match(/(-?\d+(?:\.\d+)?)\s*ppm/i);
    if (fallbackMatch) {
      const parsed = parseFloat(fallbackMatch[1]);
      if (!isNaN(parsed)) reading.nh3_ppm = parsed;
    }
  }

  return reading;
}

/**
 * Stream buffer for incoming chunks from Classic Bluetooth Serial SPP.
 * Handles partial chunks, "\r\n", and "\n" delimiters.
 */
export class SerialStreamBuffer {
  private buffer = '';

  /**
   * Appends incoming data chunk and returns any complete lines.
   */
  public append(chunk: string): string[] {
    if (!chunk) return [];
    this.buffer += chunk;

    const completeLines: string[] = [];
    let newlineIdx: number;

    while ((newlineIdx = this.buffer.indexOf('\n')) !== -1) {
      let line = this.buffer.slice(0, newlineIdx);
      this.buffer = this.buffer.slice(newlineIdx + 1);

      if (line.endsWith('\r')) {
        line = line.slice(0, -1);
      }
      line = line.trim();
      if (line.length > 0) {
        completeLines.push(line);
      }
    }

    return completeLines;
  }

  /**
   * Resets the internal buffer (e.g. on disconnect or retry).
   */
  public reset(): void {
    this.buffer = '';
  }
}
