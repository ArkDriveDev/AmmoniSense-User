import { describe, it, expect } from 'vitest';
import { parseAmmoniSenseLine, SerialStreamBuffer } from './serialParser';

describe('serialParser', () => {
  it('correctly parses a complete standard firmware line', () => {
    const raw =
      'Temp: 31.3 C | Hum: 68.0 % | MQ pin: 620 mV | AO: 1.04 V | Rs: 38.0k | R0: 11.87k | Rs/R0: 3.61 | NH3 estimate: 0.00 ppm | Battery: 23% (3.74 V) | [PPM UNVERIFIED]';

    const parsed = parseAmmoniSenseLine(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.temperature).toBe(31.3);
    expect(parsed?.humidity).toBe(68.0);
    expect(parsed?.mqPin_mV).toBe(620);
    expect(parsed?.mqAO_V).toBe(1.04);
    expect(parsed?.rs_kOhm).toBe(38.0);
    expect(parsed?.r0_kOhm).toBe(11.87);
    expect(parsed?.ratio).toBe(3.61);
    expect(parsed?.nh3_ppm).toBe(0.0);
    expect(parsed?.battery_percent).toBe(23);
    expect(parsed?.battery_voltage).toBe(3.74);
    expect(parsed?.ppm_unverified).toBe(true);
  });

  it('maps ERROR, INVALID, NOT CALIBRATED, UNAVAILABLE to null', () => {
    const raw =
      'Temp: ERROR | Hum: ERROR | MQ pin: 0 mV | AO: 0.00 V | Rs: INVALID | R0: NOT CALIBRATED | Rs/R0: 0.00 | NH3: UNAVAILABLE | Battery: 0% (0.00 V) | [PPM UNVERIFIED]';

    const parsed = parseAmmoniSenseLine(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.temperature).toBeNull();
    expect(parsed?.humidity).toBeNull();
    expect(parsed?.rs_kOhm).toBeNull();
    expect(parsed?.r0_kOhm).toBeNull();
    expect(parsed?.nh3_ppm).toBeNull();
  });

  it('buffers partial incoming stream chunks correctly', () => {
    const streamBuffer = new SerialStreamBuffer();

    const chunk1 = 'Temp: 31.3 C | Hum: 68.0 % | MQ pin: ';
    const chunk2 = '620 mV | AO: 1.04 V | Rs: 38.0k | R0: 11.87k | Rs/R0: 3.61 | NH3 estimate: 0.00 ppm | Battery: 23% (3.74 V) | [PPM UNVERIFIED]\r\n';

    const lines1 = streamBuffer.append(chunk1);
    expect(lines1).toHaveLength(0);

    const lines2 = streamBuffer.append(chunk2);
    expect(lines2).toHaveLength(1);

    const parsed = parseAmmoniSenseLine(lines2[0]);
    expect(parsed?.temperature).toBe(31.3);
    expect(parsed?.humidity).toBe(68.0);
    expect(parsed?.battery_percent).toBe(23);
  });
});
