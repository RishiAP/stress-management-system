#include "sensors.h"
#include "config.h"

#include <Wire.h>
#include <MAX30105.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// ─── Sensor Objects ─────────────────────────────────────────────────────────
static MAX30105 particleSensor;
static OneWire oneWire(ONEWIRE_PIN);
static DallasTemperature tempSensor(&oneWire);

// Track whether DS18B20 has a pending async read
static bool tempRequested = false;
static float lastTemp = 0.0f;

bool initSensors() {
  // ── MAX30102 (I2C) ──────────────────────────────────────────────────────
  Wire.begin(I2C_SDA, I2C_SCL);

  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("[SENSOR] MAX30102 not found! Check wiring.");
    return false;
  }

  // Configure for BVP (IR) readings at 100 Hz
  // sampleAverage=1 gives raw 100Hz, ledBrightness moderate, sampleRate=100
  particleSensor.setup(
    0x1F,   // LED brightness (0x00–0xFF)
    1,      // sample average (1 = no averaging)
    2,      // LED mode: 2 = Red + IR
    100,    // sample rate (Hz)
    411,    // pulse width (µs) — higher = more resolution
    4096    // ADC range
  );

  // We only care about the IR channel for BVP
  particleSensor.enableDIETEMPRDY(); // enable die temp for diagnostics

  Serial.println("[SENSOR] MAX30102 initialized (100 Hz, IR mode)");

  // ── DS18B20 (OneWire) ───────────────────────────────────────────────────
  tempSensor.begin();

  if (tempSensor.getDeviceCount() == 0) {
    Serial.println("[SENSOR] DS18B20 not found! Check wiring + 4.7k pull-up.");
    // Non-fatal: temperature will read -127.0
  } else {
    // Set to 9-bit resolution for faster reads (~94ms instead of ~750ms)
    tempSensor.setResolution(9);
    // Use async mode so we don't block loop()
    tempSensor.setWaitForConversion(false);
    Serial.println("[SENSOR] DS18B20 initialized (9-bit, async)");
  }

  // ── GSR (Analog) ───────────────────────────────────────────────────────
  // ADC1 channels work with WiFi active; ADC2 channels do NOT
  analogReadResolution(12); // 0–4095
  analogSetAttenuation(ADC_11db); // full 0–3.3V range
  Serial.println("[SENSOR] GSR analog on GPIO " + String(GSR_PIN));

  return true;
}

float readBVP() {
  // getIR() returns the raw IR LED reflectance value
  // This is the Blood Volume Pulse proxy signal
  uint32_t irValue = particleSensor.getIR();
  return static_cast<float>(irValue);
}

float readGSR() {
  // Read 12-bit ADC value and convert to voltage
  int raw = analogRead(GSR_PIN);
  float voltage = (raw / 4095.0f) * 3.3f;
  return voltage;
}

float readTemp() {
  // If we haven't started a conversion yet, start one
  if (!tempRequested) {
    tempSensor.requestTemperatures();
    tempRequested = true;
    return lastTemp; // return previous reading while we wait
  }

  // Check if conversion is complete
  if (tempSensor.isConversionComplete()) {
    float t = tempSensor.getTempCByIndex(0);
    if (t != DEVICE_DISCONNECTED_C) {
      lastTemp = t;
    }
    tempRequested = false; // allow next request
  }

  return lastTemp;
}
