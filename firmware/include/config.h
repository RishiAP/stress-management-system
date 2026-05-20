#pragma once

// ─── Pin Assignments ─────────────────────────────────────────────────────────
// MAX30102 (BVP) — I2C (uses default Wire: SDA=21, SCL=22)
#define I2C_SDA 21
#define I2C_SCL 22

// GSR — Analog input (ADC1, no conflict with WiFi)
#define GSR_PIN 34

// DS18B20 — OneWire data pin (needs external 4.7kΩ pull-up to 3.3V)
#define ONEWIRE_PIN 15

// Factory reset — hold BOOT button for 5s during startup to wipe credentials
#define RESET_BUTTON_PIN 0
#define RESET_HOLD_MS 5000

// ─── Sampling Rates (Hz) ────────────────────────────────────────────────────
#define BVP_HZ 100
#define GSR_HZ 10
#define TEMP_HZ 1

// ─── Window Duration ────────────────────────────────────────────────────────
#define WINDOW_SECONDS 10

// ─── Buffer Sizes (computed from rates × window) ────────────────────────────
#define BVP_BUFFER_SIZE (BVP_HZ * WINDOW_SECONDS)   // 1000
#define GSR_BUFFER_SIZE (GSR_HZ * WINDOW_SECONDS)    // 100
#define TEMP_BUFFER_SIZE (TEMP_HZ * WINDOW_SECONDS)  // 10

// ─── Sampling Intervals (microseconds) ──────────────────────────────────────
#define BVP_INTERVAL_US (1000000UL / BVP_HZ)   // 10,000 µs = 10 ms
#define GSR_INTERVAL_US (1000000UL / GSR_HZ)    // 100,000 µs = 100 ms
#define TEMP_INTERVAL_US (1000000UL / TEMP_HZ)  // 1,000,000 µs = 1 s

// ─── Networking ─────────────────────────────────────────────────────────────
#define WIFI_AP_NAME "NeuroSync-Setup"
#define API_ENDPOINT "/api/ingest"
#define HTTP_TIMEOUT_MS 15000

// Server URL — hardcoded for production.
// Override for local dev by adding to platformio.ini build_flags:
//   -DSERVER_URL='"http://192.168.1.100:3000"'
#ifndef SERVER_URL
#define SERVER_URL "https://your-app.vercel.app"
#endif

// ─── Preferences Namespace ──────────────────────────────────────────────────
#define PREF_NAMESPACE "neurosync"
#define PREF_KEY_TOKEN "device_token"
