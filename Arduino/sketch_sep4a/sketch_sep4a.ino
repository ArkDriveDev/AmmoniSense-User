/*
  AmmoniSense
  ESP32 + MQ-137 + DHT11 + Battery Monitor
  Classic Bluetooth + Clean-Air R0 Calibration

  IMPORTANT:
  - This sketch uses the teammate firmware pin assignments:
      DHT11 DATA = GPIO25
      MQ-137 AO  = GPIO27
      Battery ADC = GPIO34
  - Verify your actual wiring before uploading.
  - MQ-137 requires a heater supply and correct analog-voltage scaling.
  - Clean-air calibration alone does NOT verify ammonia ppm accuracy.
  - Do not use the estimated ppm value as a safety measurement until
    the sensor is validated against a suitable reference instrument.
*/

#include <Arduino.h>
#include <DHT.h>
#include <BluetoothSerial.h>
#include <Preferences.h>
#include <math.h>

// =====================================================
// PIN CONFIGURATION
// =====================================================

#define DHT_PIN       25
#define DHT_TYPE      DHT11
#define MQ_PIN        27
#define BATTERY_PIN   34

// =====================================================
// SENSOR CONFIGURATION
// =====================================================

// MQ-137 circuit assumptions.
// Verify these values against your actual module/circuit.
const float SENSOR_VCC       = 5.0;
const float RL_VALUE         = 10.0;  // Load resistance in kOhms
const float DIVIDER_RATIO    = 1.68;  // MQ AO voltage correction
const float CLEAN_AIR_RATIO  = 3.6;   // Existing assumption, not universal

// Approximate curve retained from the previous firmware.
// These constants are NOT a verified calibration curve.
const float CURVE_A = 40.0;
const float CURVE_B = -2.5;

// Battery divider configuration.
// Example: 100k and 100k resistors => ratio 2.0.
const float BAT_DIVIDER = 2.0;
const float BAT_CAL     = 1.00;

// ADC configuration
const float ADC_REFERENCE = 3.3;
const int ADC_MAX_VALUE   = 4095;

// Calibration and reporting
const int CALIBRATION_SAMPLES = 100;
const int MQ_SAMPLES          = 10;
const unsigned long REPORT_INTERVAL = 2000;

// Disable automatic R0 drift tracking.
// Recalibrate manually in clean air using command c.
const bool AUTO_R0_TRACK = false;

// =====================================================
// OBJECTS AND VARIABLES
// =====================================================

DHT dht(DHT_PIN, DHT_TYPE);
BluetoothSerial SerialBT;
Preferences prefs;

float R0 = 0.0;
float baselinePPM = 0.0;

float temperatureC = NAN;
float humidityRH = NAN;

float mqPinVoltage = 0.0;
float mqAOVoltage = 0.0;
float Rs = 0.0;
float ratio = 0.0;
float ammoniaPPM = -1.0;

float batteryVoltage = 0.0;
int batteryPercent = 0;

bool calibrated = false;

unsigned long lastReport = 0;

// =====================================================
// OUTPUT HELPERS
// =====================================================

void out(const String &message) {
  Serial.print(message);

  if (SerialBT.hasClient()) {
    SerialBT.print(message);
  }
}

void outln(const String &message) {
  out(message + "\n");
}

// =====================================================
// ADC HELPERS
// =====================================================

float readADCVoltage(int pin, int samples = 10) {
  unsigned long total = 0;

  for (int i = 0; i < samples; i++) {
    total += analogRead(pin);
    delay(5);
  }

  float average = (float)total / samples;

  return average * ADC_REFERENCE / ADC_MAX_VALUE;
}

// =====================================================
// MQ-137 READING
// =====================================================

float readMQVoltage() {
  // Voltage measured at ESP32 ADC input.
  mqPinVoltage = readADCVoltage(MQ_PIN, MQ_SAMPLES);

  // Estimate voltage at the MQ module's analog output
  // before its voltage divider.
  mqAOVoltage = mqPinVoltage * DIVIDER_RATIO;

  return mqAOVoltage;
}

float calculateRs(float sensorOutputVoltage) {
  // Avoid division by zero and invalid voltages.
  if (sensorOutputVoltage <= 0.01 ||
      sensorOutputVoltage >= SENSOR_VCC) {
    return -1.0;
  }

  // Assumes the sensor is connected to VCC and RL to ground.
  // Rs = RL * (VCC / Vout - 1)
  return RL_VALUE *
         ((SENSOR_VCC / sensorOutputVoltage) - 1.0);
}

float estimateAmmoniaPPM(float rsValue, float r0Value) {
  if (rsValue <= 0.0 || r0Value <= 0.0) {
    return -1.0;
  }

  float rsR0 = rsValue / r0Value;

  // Retained from the existing firmware.
  // Do not treat this estimate as validated ppm.
  float ppm = CURVE_A * pow(rsR0, CURVE_B);

  if (!isfinite(ppm) || ppm < 0.0) {
    return -1.0;
  }

  return ppm;
}

// =====================================================
// CLEAN-AIR R0 CALIBRATION
// =====================================================

void calibrate() {
  outln("");
  outln("=== CLEAN-AIR CALIBRATION ===");
  outln("Keep the sensor in clean air.");
  outln("Do not expose it to ammonia during this step.");
  outln("Collecting readings...");

  float voltageTotal = 0.0;
  int validSamples = 0;

  for (int i = 0; i < CALIBRATION_SAMPLES; i++) {
    float v = readMQVoltage();

    if (v > 0.01 && v < SENSOR_VCC) {
      voltageTotal += v;
      validSamples++;
    }

    delay(100);
  }

  if (validSamples < CALIBRATION_SAMPLES / 2) {
    outln("ERROR: Too many invalid MQ-137 readings.");
    outln("Check wiring, ADC scaling, and sensor supply.");
    return;
  }

  float averageVoltage = voltageTotal / validSamples;
  float rsAir = calculateRs(averageVoltage);

  if (rsAir <= 0.0) {
    outln("ERROR: Could not calculate clean-air Rs.");
    return;
  }

  // Calculate R0 from the existing clean-air ratio assumption.
  R0 = rsAir / CLEAN_AIR_RATIO;

  // Save the calibration value in ESP32 non-volatile storage.
  prefs.putFloat("r0", R0);

  baselinePPM = CURVE_A *
                pow(CLEAN_AIR_RATIO, CURVE_B);

  calibrated = true;

  outln("");
  outln("Clean-air calibration complete.");
  outln("Average MQ voltage: " +
        String(averageVoltage, 3) + " V");

  outln("Clean-air Rs: " +
        String(rsAir, 2) + " kOhm");

  outln("Calculated R0: " +
        String(R0, 2) + " kOhm");

  outln("R0 saved to ESP32 Preferences.");
  outln("Reminder: clean-air calibration does not");
  outln("validate the ppm curve.");
  outln("==============================");
  outln("");
}

// =====================================================
// BATTERY MONITORING
// =====================================================

float readBatteryVoltage() {
  float adcVoltage = readADCVoltage(BATTERY_PIN, 20);

  return adcVoltage * BAT_DIVIDER * BAT_CAL;
}

int estimateBatteryPercent(float voltage) {
  /*
    Approximate lookup for a single-cell lithium battery.
    Adjust this table for your actual battery chemistry.
    Voltage-based percentage is not a precise state-of-charge
    measurement, especially while the device is under load.
  */

  if (voltage >= 4.20) return 100;
  if (voltage >= 4.15) return 95;
  if (voltage >= 4.11) return 90;
  if (voltage >= 4.08) return 85;
  if (voltage >= 4.02) return 80;
  if (voltage >= 3.98) return 75;
  if (voltage >= 3.95) return 70;
  if (voltage >= 3.91) return 65;
  if (voltage >= 3.87) return 60;
  if (voltage >= 3.85) return 55;
  if (voltage >= 3.84) return 50;
  if (voltage >= 3.82) return 45;
  if (voltage >= 3.80) return 40;
  if (voltage >= 3.79) return 35;
  if (voltage >= 3.77) return 30;
  if (voltage >= 3.75) return 25;
  if (voltage >= 3.73) return 20;
  if (voltage >= 3.71) return 15;
  if (voltage >= 3.69) return 10;
  if (voltage >= 3.60) return 5;

  return 0;
}

// =====================================================
// DHT11
// =====================================================

void readDHT() {
  temperatureC = dht.readTemperature();
  humidityRH = dht.readHumidity();

  if (isnan(temperatureC) || isnan(humidityRH)) {
    outln("WARNING: DHT11 read failed.");
  }
}

// =====================================================
// SERIAL / BLUETOOTH COMMANDS
// =====================================================

void printHelp() {
  outln("");
  outln("=== AmmoniSense Commands ===");
  outln("c = Recalibrate R0 in clean air");
  outln("r = Reset saved R0 calibration");
  outln("h = Show this help");
  outln("============================");
  outln("");
}

void handleCommand(char command) {
  switch (command) {
    case 'c':
    case 'C':
      calibrate();
      break;

    case 'r':
    case 'R':
      prefs.remove("r0");

      R0 = 0.0;
      calibrated = false;

      outln("Saved R0 removed.");
      outln("Place sensor in clean air and send c.");
      break;

    case 'h':
    case 'H':
      printHelp();
      break;

    default:
      break;
  }
}

void checkCommands() {
  while (Serial.available()) {
    handleCommand((char)Serial.read());
  }

  while (SerialBT.available()) {
    handleCommand((char)SerialBT.read());
  }
}

// =====================================================
// REPORTING
// =====================================================

void reportReadings() {
  readDHT();

  readMQVoltage();
  Rs = calculateRs(mqAOVoltage);

  if (Rs > 0.0 && R0 > 0.0) {
    ratio = Rs / R0;
    ammoniaPPM = estimateAmmoniaPPM(Rs, R0);
  } else {
    ratio = 0.0;
    ammoniaPPM = -1.0;
  }

  batteryVoltage = readBatteryVoltage();
  batteryPercent = estimateBatteryPercent(batteryVoltage);

  String line = "";

  if (!isnan(temperatureC)) {
    line += "Temp: " + String(temperatureC, 1) + " C";
  } else {
    line += "Temp: ERROR";
  }

  line += " | ";

  if (!isnan(humidityRH)) {
    line += "Hum: " + String(humidityRH, 1) + " %";
  } else {
    line += "Hum: ERROR";
  }

  line += " | MQ pin: " +
          String(mqPinVoltage * 1000.0, 0) + " mV";

  line += " | AO: " +
          String(mqAOVoltage, 2) + " V";

  if (Rs > 0.0) {
    line += " | Rs: " + String(Rs, 2) + "k";
  } else {
    line += " | Rs: INVALID";
  }

  if (R0 > 0.0) {
    line += " | R0: " + String(R0, 2) + "k";
  } else {
    line += " | R0: NOT CALIBRATED";
  }

  line += " | Rs/R0: " + String(ratio, 2);

  if (ammoniaPPM >= 0.0) {
    line += " | NH3 estimate: " +
            String(ammoniaPPM, 2) + " ppm";
  } else {
    line += " | NH3: UNAVAILABLE";
  }

  line += " | Battery: " +
          String(batteryPercent) + "% (" +
          String(batteryVoltage, 2) + " V)";

  // Clean-air calibration alone cannot confirm safe ammonia levels.
  line += " | [PPM UNVERIFIED]";

  outln(line);
}

// =====================================================
// SETUP
// =====================================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  analogReadResolution(12);

  pinMode(MQ_PIN, INPUT);
  pinMode(BATTERY_PIN, INPUT);

  dht.begin();

  // Classic Bluetooth serial connection.
  if (!SerialBT.begin("AmmoniSense")) {
    Serial.println("WARNING: Bluetooth initialization failed.");
  }

  // Open persistent storage.
  prefs.begin("ammonisense", false);

  outln("");
  outln("==================================");
  outln("       AmmoniSense Starting");
  outln("==================================");
  outln("Serial baud: 115200");
  outln("Bluetooth name: AmmoniSense");

  outln("DHT11 pin: GPIO" + String(DHT_PIN));
  outln("MQ-137 pin: GPIO" + String(MQ_PIN));
  outln("Battery pin: GPIO" + String(BATTERY_PIN));

  outln("Automatic R0 tracking: OFF");

  // Load saved clean-air calibration if available.
  float savedR0 = prefs.getFloat("r0", 0.0);

  if (savedR0 > 0.0 && isfinite(savedR0)) {
    R0 = savedR0;

    baselinePPM = CURVE_A *
                  pow(CLEAN_AIR_RATIO, CURVE_B);

    calibrated = true;

    outln("Loaded saved clean-air R0: " +
          String(R0, 2) + " kOhm");
  } else {
    outln("No saved R0 found.");
    outln("Starting clean-air calibration...");
    delay(1000);
    calibrate();
  }

  printHelp();

  outln("Initialization complete.");
  outln("==================================");
}

// =====================================================
// MAIN LOOP
// =====================================================

void loop() {
  checkCommands();

  unsigned long now = millis();

  if (now - lastReport >= REPORT_INTERVAL) {
    lastReport = now;
    reportReadings();
  }

  delay(10);
}