#include <Arduino.h>
#include <WiFi.h>

#include "config.h"
#include "provisioning.h"
#include "sensors.h"
#include "sampler.h"
#include "api_client.h"

// ─── Transmission Buffers (allocated once) ──────────────────────────────────
static float txBvp[BVP_BUFFER_SIZE];
static float txGsr[GSR_BUFFER_SIZE];
static float txTemp[TEMP_BUFFER_SIZE];

// ─── WiFi Reconnect Tracking ───────────────────────────────────────────────
static unsigned long lastWifiCheck = 0;
static const unsigned long WIFI_CHECK_INTERVAL_MS = 10000; // 10s

// ─── Wear Detection Thresholds ─────────────────────────────────────────────
// MAX30102 IR reflectance: finger present → >50k, empty → <10k
static const float IR_WEAR_THRESHOLD = 50000.0f;
// GSR open circuit: reads near 0V or near 3.3V when pads aren't touching skin
static const float GSR_LOW_THRESHOLD = 0.1f;
static const float GSR_HIGH_THRESHOLD = 3.2f;

void setup() {
  Serial.begin(115200);
  delay(500); // let Serial settle
  Serial.println();
  Serial.println("╔══════════════════════════════════════╗");
  Serial.println("║   NeuroSync ESP32 Firmware v1.1      ║");
  Serial.println("╚══════════════════════════════════════╝");

  // ── 1. Check for factory reset (hold BOOT button) ────────────────────────
  checkFactoryReset();

  // ── 2. WiFi + Token provisioning ──────────────────────────────────────────
  runProvisioning();

  // ── 3. Initialize sensors ─────────────────────────────────────────────────
  if (!initSensors()) {
    Serial.println("[MAIN] CRITICAL: Sensor init failed. Halting.");
    while (true) { delay(1000); } // halt — user must fix wiring
  }

  // ── 4. Initialize sampler ─────────────────────────────────────────────────
  initSampler();

  // ── 5. Initialize API client ──────────────────────────────────────────────
  String serverUrl = getServerUrl();
  String token = getDeviceToken();
  initApiClient(serverUrl.c_str(), token.c_str());

  // ── Ready ─────────────────────────────────────────────────────────────────
  Serial.println();
  Serial.println("[MAIN] ════════════════════════════════════");
  Serial.println("[MAIN] System ready!");
  Serial.println("[MAIN] IP:     " + WiFi.localIP().toString());
  Serial.println("[MAIN] Server: " + serverUrl);
  Serial.println("[MAIN] Window: " + String(WINDOW_SECONDS) + "s");
  Serial.println("[MAIN] ════════════════════════════════════");
  Serial.println();
}

void loop() {
  // ── Sample sensors at their respective rates ──────────────────────────────
  samplerTick();

  // ── Check if a complete window is ready ───────────────────────────────────
  if (isWindowReady()) {
    Serial.println("[MAIN] Window ready — analyzing...");

    // Copy data out of ring buffers
    getWindow(txBvp, txGsr, txTemp);

    // ── Compute averages for wear detection ─────────────────────────────────
    float avgBvp = 0, avgGsr = 0, avgTemp = 0;
    for (int i = 0; i < BVP_BUFFER_SIZE; i++) avgBvp += txBvp[i];
    avgBvp /= BVP_BUFFER_SIZE;

    for (int i = 0; i < GSR_BUFFER_SIZE; i++) avgGsr += txGsr[i];
    avgGsr /= GSR_BUFFER_SIZE;

    for (int i = 0; i < TEMP_BUFFER_SIZE; i++) avgTemp += txTemp[i];
    avgTemp /= TEMP_BUFFER_SIZE;

    Serial.println("[MAIN] Avg IR:   " + String(avgBvp, 0));
    Serial.println("[MAIN] Avg GSR:  " + String(avgGsr, 2) + " V");
    Serial.println("[MAIN] Avg Temp: " + String(avgTemp, 2) + " °C");

    // ── Wear detection: check if ANY sensor indicates not worn ──────────────
    bool irBad = avgBvp < IR_WEAR_THRESHOLD;
    bool gsrBad = avgGsr < GSR_LOW_THRESHOLD || avgGsr > GSR_HIGH_THRESHOLD;

    if (irBad || gsrBad) {
      // Device not worn — send empty heartbeat
      Serial.print("[MAIN] NOT WORN → ");
      if (irBad) Serial.print("IR low ");
      if (gsrBad) Serial.print("GSR open-circuit ");
      Serial.println();

      bool ok = sendWindow(nullptr, 0, nullptr, 0, nullptr, 0);
      Serial.println(ok ? "[MAIN] ✓ Heartbeat sent" : "[MAIN] ✗ Heartbeat failed");
    } else {
      // Device worn — send full physiological data
      Serial.println("[MAIN] WORN → sending data...");

      bool ok = sendWindow(txBvp, BVP_BUFFER_SIZE,
                           txGsr, GSR_BUFFER_SIZE,
                           txTemp, TEMP_BUFFER_SIZE);

      if (ok) {
        Serial.println("[MAIN] ✓ Window sent successfully");
      } else {
        Serial.println("[MAIN] ✗ Window send failed — will retry next window");
      }
    }

    Serial.println();
  }

  // ── Periodic WiFi health check ────────────────────────────────────────────
  unsigned long now = millis();
  if (now - lastWifiCheck >= WIFI_CHECK_INTERVAL_MS) {
    lastWifiCheck = now;

    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[MAIN] WiFi lost — attempting reconnect...");
      WiFi.reconnect();
    }
  }
}