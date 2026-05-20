#include "provisioning.h"
#include "config.h"

#include <Arduino.h>
#include <WiFiManager.h>
#include <Preferences.h>

// ─── Persistent Storage ─────────────────────────────────────────────────────
static Preferences preferences;
static String storedToken;

void checkFactoryReset() {
  pinMode(RESET_BUTTON_PIN, INPUT_PULLUP);

  // Check if button is being held on boot
  if (digitalRead(RESET_BUTTON_PIN) == LOW) {
    Serial.println("[PROV] Reset button detected — hold for 5s to factory reset...");
    unsigned long start = millis();

    while (digitalRead(RESET_BUTTON_PIN) == LOW) {
      if (millis() - start >= RESET_HOLD_MS) {
        Serial.println("[PROV] *** FACTORY RESET ***");

        // Wipe WiFiManager saved networks
        WiFiManager wm;
        wm.resetSettings();

        // Wipe our custom preferences (token)
        preferences.begin(PREF_NAMESPACE, false);
        preferences.clear();
        preferences.end();

        Serial.println("[PROV] All credentials wiped. Restarting...");
        delay(1000);
        ESP.restart();
      }
      delay(50);
    }

    Serial.println("[PROV] Button released before 5s — skipping reset.");
  }
}

void runProvisioning() {
  WiFiManager wm;

  // Only custom field: the device token from the dashboard
  WiFiManagerParameter tokenParam("token", "Device Token (paste from Dashboard)", "", 80);

  // Load any previously stored token
  preferences.begin(PREF_NAMESPACE, true); // read-only
  storedToken = preferences.getString(PREF_KEY_TOKEN, "");
  preferences.end();

  wm.addParameter(&tokenParam);

  // Set a timeout so it doesn't block forever
  wm.setConfigPortalTimeout(300); // 5 minutes

  // Custom AP page text
  wm.setTitle("NeuroSync Device Setup");

  Serial.println("[PROV] Starting WiFiManager...");

  // autoConnect: tries saved creds first, falls back to captive portal
  if (!wm.autoConnect(WIFI_AP_NAME)) {
    Serial.println("[PROV] Failed to connect — restarting in 5s...");
    delay(5000);
    ESP.restart();
  }

  Serial.println("[PROV] WiFi connected!");
  Serial.println("[PROV] IP: " + WiFi.localIP().toString());

  // Save token if it was entered (non-empty)
  String newToken = String(tokenParam.getValue());

  preferences.begin(PREF_NAMESPACE, false); // read-write

  if (newToken.length() > 0) {
    preferences.putString(PREF_KEY_TOKEN, newToken);
    storedToken = newToken;
    Serial.println("[PROV] Device token saved (" + String(newToken.length()) + " chars)");
  }

  preferences.end();

  // Validate we have what we need
  if (storedToken.length() == 0) {
    Serial.println("[PROV] WARNING: No device token stored! Ingestion will fail.");
    Serial.println("[PROV] Hold BOOT button for 5s on next restart to re-provision.");
  }

  Serial.println("[PROV] Server: " + String(SERVER_URL));
}

String getDeviceToken() {
  if (storedToken.length() > 0) return storedToken;

  // Fallback: read from flash
  preferences.begin(PREF_NAMESPACE, true);
  storedToken = preferences.getString(PREF_KEY_TOKEN, "");
  preferences.end();
  return storedToken;
}

String getServerUrl() {
  return String(SERVER_URL);
}
