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

void setup() {
  Serial.begin(115200);
  delay(500); // let Serial settle
  Serial.println();
  Serial.println("╔══════════════════════════════════════╗");
  Serial.println("║   NeuroSync ESP32 Firmware v1.0      ║");
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
    Serial.println("[MAIN] Window ready — transmitting...");

    // Copy data out of ring buffers
    getWindow(txBvp, txGsr, txTemp);

    // Send to backend
    bool ok = sendWindow(txBvp, BVP_BUFFER_SIZE,
                         txGsr, GSR_BUFFER_SIZE,
                         txTemp, TEMP_BUFFER_SIZE);

    if (ok) {
      Serial.println("[MAIN] ✓ Window sent successfully");
    } else {
      Serial.println("[MAIN] ✗ Window send failed — will retry next window");
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