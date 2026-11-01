# AmmoniSense-User
AmmoniSense:A Solar Powered Iot-Based Ammonia Detection and Monitoring System for Swine Farm Waste Management_ARDIUser


ARDUINO IDE LASTEST CODE


/*
  AmmoniSense v2
  ESP32 + MQ-137 + DHT22 + Battery Monitor
  Classic Bluetooth + R0 clean-air calibration + 2-point ppm calibration

  Pins:
    DHT22   -> D25
    MQ-137  -> D34 (ADC1, input-only)
    Battery -> D32 (ADC1)

  Commands (end each with Enter/newline):
    c            Clean-air R0 calibration (after warm-up)
    c force      Calibrate even before warm-up finishes
    k1 <ppm>     Record calibration point 1 at a known NH3 concentration
    k2 <ppm>     Record calibration point 2 (a clearly different concentration)
    x            Clear the saved ppm curve (back to provisional)
    r            Reset saved R0 (also clears the curve)
    h            Help

  NOTE: ppm is only meaningful after R0 AND a 2-point curve calibration
  against a known ammonia source / reference instrument.
*/

#include <Arduino.h>
#include <DHT.h>
#include <BluetoothSerial.h>
#include <Preferences.h>
#include <math.h>

// ---------------- PINS ----------------
#define DHT_PIN      25
#define DHT_TYPE     DHT22
#define MQ_PIN       34
#define BATTERY_PIN  32

// ---------------- SENSOR CIRCUIT ----------------
const float SENSOR_VCC      = 5.0;
const float RL_VALUE        = 10.0;
const float CLEAN_AIR_RATIO = 3.6;

// AO -> R_TOP -> GPIO34 -> R_BOTTOM -> GND
const float R_DIV_TOP_K     = 10.0;
const float R_DIV_BOTTOM_K  = 15.0;
const float DIVIDER_RATIO   = (R_DIV_TOP_K + R_DIV_BOTTOM_K) / R_DIV_BOTTOM_K;

// Provisional curve (NOT verified). Replaced by k1/k2 calibration.
const float DEFAULT_CURVE_A = 40.0;
const float DEFAULT_CURVE_B = -2.5;

const float PPM_MIN_REPORT = 0.0;
const float PPM_MAX_REPORT = 500.0;

// ---------------- BATTERY ----------------
// Battery (+) -> 100k -> GPIO32 -> 100k -> GND
const float BAT_DIVIDER = 2.0;

// BAT_CAL = actual multimeter voltage / voltage shown by ESP32
const float BAT_CAL = 1.00;

// ---------------- TIMING ----------------
const int CALIBRATION_SAMPLES = 100;
const int POINT_SAMPLES       = 30;
const unsigned long REPORT_INTERVAL = 2000;
const unsigned long WARMUP_MS       = 180000UL;

// ---------------- OBJECTS / STATE ----------------
DHT dht(DHT_PIN, DHT_TYPE);
BluetoothSerial SerialBT;
Preferences prefs;

float R0 = 0.0;
float curveA = DEFAULT_CURVE_A;
float curveB = DEFAULT_CURVE_B;
bool curveCalibrated = false;

float pt1Ratio = 0, pt1PPM = 0; bool pt1Set = false;
float pt2Ratio = 0, pt2PPM = 0; bool pt2Set = false;

float temperatureC = NAN, humidityRH = NAN;
float mqPinVoltage = 0, mqAOVoltage = 0, Rs = 0, ratio = 0, ammoniaPPM = -1;

// Battery variables
float batteryPinVoltage = 0;
float batteryVoltage = 0;
int batteryPercent = 0;
const char* batteryStatus = "UNKNOWN";

unsigned long lastReport = 0;
String cmdBufferSerial = "";
String cmdBufferBT = "";

// ---------------- OUTPUT ----------------
void out(const String &m) {
  Serial.print(m);
  if (SerialBT.hasClient()) SerialBT.print(m);
}

void outln(const String &m) {
  out(m + "\n");
}

// ---------------- ADC ----------------
float readPinVoltage(int pin, int samples) {
  uint32_t total = 0;

  for (int i = 0; i < samples; i++) {
    total += analogReadMilliVolts(pin);
    delay(5);
  }

  return (total / (float)samples) / 1000.0f;
}

// ---------------- MQ-137 ----------------
float readMQVoltage(int samples = 10) {
  mqPinVoltage = readPinVoltage(MQ_PIN, samples);
  mqAOVoltage  = mqPinVoltage * DIVIDER_RATIO;

  return mqAOVoltage;
}

float calculateRs(float vout) {
  if (vout <= 0.05f || vout >= SENSOR_VCC - 0.05f)
    return -1.0f;

  return RL_VALUE * ((SENSOR_VCC / vout) - 1.0f);
}

float estimatePPM(float rsValue, float r0Value) {
  if (rsValue <= 0 || r0Value <= 0)
    return -1.0f;

  float ppm = curveA * pow(rsValue / r0Value, curveB);

  if (!isfinite(ppm) || ppm < 0)
    return -1.0f;

  if (ppm < PPM_MIN_REPORT) ppm = PPM_MIN_REPORT;
  if (ppm > PPM_MAX_REPORT) ppm = PPM_MAX_REPORT;

  return ppm;
}

float averageRatio(int samples) {
  float total = 0;
  int valid = 0;

  for (int i = 0; i < samples; i++) {
    float rs = calculateRs(readMQVoltage(5));

    if (rs > 0) {
      total += rs / R0;
      valid++;
    }

    delay(100);
  }

  if (valid < samples / 2)
    return -1.0f;

  return total / valid;
}

// ---------------- CURVE STORAGE ----------------
void saveCurve() {
  prefs.putFloat("ca", curveA);
  prefs.putFloat("cb", curveB);
  prefs.putBool("cal", true);
}

void clearCurve() {
  prefs.remove("ca");
  prefs.remove("cb");
  prefs.remove("cal");

  curveA = DEFAULT_CURVE_A;
  curveB = DEFAULT_CURVE_B;
  curveCalibrated = false;

  pt1Set = pt2Set = false;
}

// ---------------- CALIBRATION ----------------
void calibrateR0(bool force) {
  if (!force && millis() < WARMUP_MS) {
    outln("Sensor still warming up. Wait " +
          String((WARMUP_MS - millis()) / 1000) +
          " s more, or send: c force");
    return;
  }

  outln("\n=== CLEAN-AIR R0 CALIBRATION ===");
  outln("Sensor must be in clean air. Collecting...");

  float vTotal = 0;
  int valid = 0;

  for (int i = 0; i < CALIBRATION_SAMPLES; i++) {
    float v = readMQVoltage(5);

    if (calculateRs(v) > 0) {
      vTotal += v;
      valid++;
    }

    delay(100);
  }

  if (valid < CALIBRATION_SAMPLES / 2) {
    outln("ERROR: too many invalid readings. Check wiring/supply/divider.");
    return;
  }

  float rsAir = calculateRs(vTotal / valid);

  if (rsAir <= 0) {
    outln("ERROR: could not compute Rs.");
    return;
  }

  R0 = rsAir / CLEAN_AIR_RATIO;
  prefs.putFloat("r0", R0);

  clearCurve();

  outln("Avg AO voltage: " + String(vTotal / valid, 3) + " V");
  outln("Clean-air Rs: " + String(rsAir, 2) + " kOhm");
  outln("R0: " + String(R0, 2) + " kOhm (saved)");
  outln("Curve cleared. Redo k1/k2 for accurate ppm.");
  outln("================================\n");
}

void fitCurve() {
  if (fabs(pt1PPM - pt2PPM) < 1e-3 ||
      fabs(pt1Ratio - pt2Ratio) < 1e-3) {

    outln("ERROR: points too similar. Use clearly different concentrations.");
    return;
  }

  float b = log(pt2PPM / pt1PPM) / log(pt2Ratio / pt1Ratio);
  float a = pt1PPM / pow(pt1Ratio, b);

  if (!isfinite(a) || !isfinite(b) || b >= 0) {
    outln("ERROR: fit invalid (b should be negative: Rs/R0 drops as NH3 rises).");
    outln("Check that k1/k2 used different, stable concentrations. Redo them.");

    pt1Set = pt2Set = false;
    return;
  }

  curveA = a;
  curveB = b;
  curveCalibrated = true;

  saveCurve();

  outln("Curve fitted and saved: ppm = " + String(a, 3) +
        " * (Rs/R0)^" + String(b, 3));
}

void recordPoint(int which, float knownPPM) {
  if (R0 <= 0) {
    outln("Calibrate R0 first (c).");
    return;
  }

  if (knownPPM <= 0) {
    outln("Provide a ppm > 0, e.g. k1 25");
    return;
  }

  outln("Averaging readings at " + String(knownPPM, 1) +
        " ppm... keep gas concentration stable.");

  float r = averageRatio(POINT_SAMPLES);

  if (r <= 0) {
    outln("ERROR: invalid readings.");
    return;
  }

  if (which == 1) {
    pt1Ratio = r;
    pt1PPM = knownPPM;
    pt1Set = true;
  } else {
    pt2Ratio = r;
    pt2PPM = knownPPM;
    pt2Set = true;
  }

  outln("Point " + String(which) + ": Rs/R0=" + String(r, 3) +
        " @ " + String(knownPPM, 1) + " ppm");

  if (pt1Set && pt2Set)
    fitCurve();
  else
    outln("Now record the other point (k" +
          String(which == 1 ? 2 : 1) + " <ppm>).");
}

// ---------------- BATTERY ----------------
float readBatteryVoltage() {
  batteryPinVoltage = readPinVoltage(BATTERY_PIN, 30);

  return batteryPinVoltage * BAT_DIVIDER * BAT_CAL;
}

int estimateBatteryPercent(float v) {

  // Approximate voltage table for a single-cell Li-ion battery.
  static const float volts[] = {
    4.20, 4.15, 4.11, 4.08, 4.02, 3.98,
    3.95, 3.91, 3.87, 3.85, 3.84, 3.82,
    3.80, 3.79, 3.77, 3.75, 3.73, 3.71,
    3.69, 3.60, 3.50, 3.30
  };

  static const int percent[] = {
    100, 95, 90, 85, 80, 75,
    70, 65, 60, 55, 50, 45,
    40, 35, 30, 25, 20, 15,
    10, 5, 2, 0
  };

  const int count = sizeof(volts) / sizeof(volts[0]);

  if (v >= volts[0])
    return 100;

  if (v <= volts[count - 1])
    return 0;

  // Interpolate between voltage values.
  for (int i = 0; i < count - 1; i++) {

    if (v <= volts[i] && v >= volts[i + 1]) {

      float fraction =
        (v - volts[i + 1]) /
        (volts[i] - volts[i + 1]);

      float result =
        percent[i + 1] +
        fraction * (percent[i] - percent[i + 1]);

      return constrain((int)lroundf(result), 0, 100);
    }
  }

  return 0;
}

const char* getBatteryStatus(float v) {

  if (v <= 3.40f)
    return "CHARGE NOW";

  if (v <= 3.60f)
    return "LOW - CHARGE SOON";

  if (v <= 3.75f)
    return "MID - PLAN TO CHARGE";

  return "GOOD";
}

// ---------------- DHT22 ----------------
void readDHT() {
  temperatureC = dht.readTemperature();
  humidityRH = dht.readHumidity();

  if (isnan(temperatureC) || isnan(humidityRH)) {
    outln("WARNING: DHT22 read failed (check wiring / 10k pull-up on DATA).");
  }
}

// ---------------- COMMANDS ----------------
void printHelp() {
  outln("\n=== AmmoniSense Commands (end with Enter) ===");
  outln("c          = Clean-air R0 calibration");
  outln("c force    = Calibrate before warm-up ends");
  outln("k1 <ppm>   = Record calibration point 1");
  outln("k2 <ppm>   = Record calibration point 2");
  outln("x          = Clear saved ppm curve");
  outln("r          = Reset saved R0");
  outln("h          = Help");
  outln("=============================================\n");
}

void handleCommand(String cmd) {
  cmd.trim();
  cmd.toLowerCase();

  if (cmd.length() == 0)
    return;

  if (cmd == "c") {
    calibrateR0(false);

  } else if (cmd == "c force") {
    calibrateR0(true);

  } else if (cmd.startsWith("k1 ")) {
    recordPoint(1, cmd.substring(3).toFloat());

  } else if (cmd.startsWith("k2 ")) {
    recordPoint(2, cmd.substring(3).toFloat());

  } else if (cmd == "x") {
    clearCurve();
    outln("Saved ppm curve cleared. Using provisional curve (UNVERIFIED).");

  } else if (cmd == "r") {
    prefs.remove("r0");
    R0 = 0.0;
    clearCurve();

    outln("Saved R0 and curve removed. Put sensor in clean air and send c.");

  } else if (cmd == "h") {
    printHelp();

  } else {
    outln("Unknown command. Send h for help.");
  }
}

void readLines(Stream &s, String &buf) {
  while (s.available()) {

    char ch = (char)s.read();

    if (ch == '\n' || ch == '\r') {

      if (buf.length()) {
        handleCommand(buf);
        buf = "";
      }

    } else if (buf.length() < 40) {
      buf += ch;
    }
  }
}

void checkCommands() {
  readLines(Serial, cmdBufferSerial);
  readLines(SerialBT, cmdBufferBT);
}

// ---------------- REPORTING ----------------
void reportReadings() {

  readDHT();

  readMQVoltage();
  Rs = calculateRs(mqAOVoltage);

  if (Rs > 0.0 && R0 > 0.0) {
    ratio = Rs / R0;
    ammoniaPPM = estimatePPM(Rs, R0);
  } else {
    ratio = 0.0;
    ammoniaPPM = -1.0;
  }

  // Battery monitoring
  batteryVoltage = readBatteryVoltage();
  batteryPercent = estimateBatteryPercent(batteryVoltage);
  batteryStatus = getBatteryStatus(batteryVoltage);

  String line = "";

  line += !isnan(temperatureC)
    ? "Temp: " + String(temperatureC, 1) + " C"
    : "Temp: ERROR";

  line += " | ";

  line += !isnan(humidityRH)
    ? "Hum: " + String(humidityRH, 1) + " %"
    : "Hum: ERROR";

  line += " | MQ pin: " + String(mqPinVoltage * 1000.0, 0) + " mV";
  line += " | AO: " + String(mqAOVoltage, 2) + " V";

  line += (Rs > 0.0)
    ? " | Rs: " + String(Rs, 2) + "k"
    : " | Rs: INVALID";

  line += (R0 > 0.0)
    ? " | R0: " + String(R0, 2) + "k"
    : " | R0: NOT CALIBRATED";

  line += " | Rs/R0: " + String(ratio, 2);

  if (ammoniaPPM >= 0.0) {
    line += " | NH3: " + String(ammoniaPPM, 2) + " ppm";
  } else {
    line += " | NH3: UNAVAILABLE";
  }

  // Battery information
  line += " | Batt ADC: " + String(batteryPinVoltage, 3) + " V";
  line += " | Battery: " + String(batteryVoltage, 2) + " V";
  line += " | Level: " + String(batteryPercent) + "%";
  line += " | Status: " + String(batteryStatus);

  if (millis() < WARMUP_MS)
    line += " | [WARMING UP]";

  if (!curveCalibrated)
    line += " | [PPM UNVERIFIED]";

  outln(line);
}

// ---------------- SETUP ----------------
void setup() {

  Serial.begin(115200);
  delay(1000);

  analogReadResolution(12);
  analogSetPinAttenuation(MQ_PIN, ADC_11db);
  analogSetPinAttenuation(BATTERY_PIN, ADC_11db);

  pinMode(MQ_PIN, INPUT);
  pinMode(BATTERY_PIN, INPUT);

  dht.begin();

  if (!SerialBT.begin("AmmoniSense")) {
    Serial.println("WARNING: Bluetooth initialization failed.");
  }

  prefs.begin("ammonisense", false);

  outln("");
  outln("==================================");
  outln("       AmmoniSense Starting");
  outln("==================================");

  outln("Serial baud: 115200");
  outln("Bluetooth name: AmmoniSense");
  outln("DHT22 pin: GPIO" + String(DHT_PIN));
  outln("MQ-137 pin: GPIO" + String(MQ_PIN));
  outln("Battery pin: GPIO" + String(BATTERY_PIN));

  outln("AO divider: " + String(R_DIV_TOP_K, 1) + "k top / " +
        String(R_DIV_BOTTOM_K, 1) + "k bottom = ratio " +
        String(DIVIDER_RATIO, 3));

  float savedR0 = prefs.getFloat("r0", 0.0);

  if (savedR0 > 0.0 && isfinite(savedR0)) {
    R0 = savedR0;
    outln("Loaded saved R0: " + String(R0, 2) + " kOhm");
  } else {
    outln("No saved R0. After warm-up, put sensor in clean air and send c.");
  }

  if (prefs.getBool("cal", false)) {

    curveA = prefs.getFloat("ca", DEFAULT_CURVE_A);
    curveB = prefs.getFloat("cb", DEFAULT_CURVE_B);

    if (isfinite(curveA) && isfinite(curveB) && curveB < 0) {

      curveCalibrated = true;

      outln("Loaded saved curve: ppm = " + String(curveA, 3) +
            " * (Rs/R0)^" + String(curveB, 3));

    } else {
      clearCurve();
    }

  } else {
    outln("No ppm curve calibration. Readings are PROVISIONAL.");
  }

  printHelp();

  outln("Initialization complete.");
  outln("==================================");
}

// ---------------- LOOP ----------------
void loop() {

  checkCommands();

  unsigned long now = millis();

  if (now - lastReport >= REPORT_INTERVAL) {
    lastReport = now;
    reportReadings();
  }

  delay(10);
}
