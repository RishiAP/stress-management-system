#include "api_client.h"
#include "config.h"

#include <Arduino.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <ArduinoJson.h>

// ─── State ──────────────────────────────────────────────────────────────────
static String serverUrl;
static String deviceToken;

void initApiClient(const char* url, const char* token) {
  serverUrl = String(url);
  deviceToken = String(token);

  // Ensure URL doesn't have a trailing slash
  if (serverUrl.endsWith("/")) {
    serverUrl.remove(serverUrl.length() - 1);
  }

  Serial.println("[API] Client initialized");
  Serial.println("[API] Server: " + serverUrl);
  Serial.println("[API] Token:  " + deviceToken.substring(0, 8) + "...");
}

bool sendWindow(const float* bvp, int bvpLen,
                const float* gsr, int gsrLen,
                const float* temp, int tempLen) {

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[API] WiFi disconnected — skipping POST");
    return false;
  }

  String url = serverUrl + API_ENDPOINT;

  // ── Build JSON with ArduinoJson ──────────────────────────────────────────
  JsonDocument doc;

  JsonArray bvpArr = doc["bvp_window"].to<JsonArray>();
  if (bvp != nullptr) {
    for (int i = 0; i < bvpLen; i++) {
      bvpArr.add(serialized(String(bvp[i], 2)));
    }
  }

  JsonArray gsrArr = doc["gsr_window"].to<JsonArray>();
  if (gsr != nullptr) {
    for (int i = 0; i < gsrLen; i++) {
      gsrArr.add(serialized(String(gsr[i], 4)));
    }
  }

  JsonArray tempArr = doc["temp_window"].to<JsonArray>();
  if (temp != nullptr) {
    for (int i = 0; i < tempLen; i++) {
      tempArr.add(serialized(String(temp[i], 2)));
    }
  }

  // Serialize to string
  String payload;
  serializeJson(doc, payload);

  bool isHeartbeat = (bvpLen == 0 && gsrLen == 0 && tempLen == 0);
  Serial.println("[API] " + String(isHeartbeat ? "Heartbeat" : "Data") +
                 " payload: " + String(payload.length()) + " bytes");

  // ── HTTP POST ────────────────────────────────────────────────────────────
  HTTPClient http;
  http.begin(url);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + deviceToken);

  unsigned long start = millis();
  int httpCode = http.POST(payload);
  unsigned long elapsed = millis() - start;

  if (httpCode == 200) {
    String response = http.getString();
    Serial.println("[API] ✓ 200 OK (" + String(elapsed) + "ms)");

    // Parse response for debug logging (only for data, not heartbeats)
    if (!isHeartbeat) {
      JsonDocument resDoc;
      DeserializationError err = deserializeJson(resDoc, response);
      if (!err) {
        float score = resDoc["hybridScore"] | -1.0f;
        const char* category = resDoc["category"] | "unknown";
        Serial.println("[API] Score: " + String(score, 1) +
                       " | Category: " + String(category));
      }
    }

    http.end();
    return true;
  } else {
    Serial.println("[API] ✗ HTTP " + String(httpCode) + " (" + String(elapsed) + "ms)");
    if (httpCode > 0) {
      String body = http.getString();
      Serial.println("[API] Response: " + body.substring(0, 200));
    } else {
      Serial.println("[API] Error: " + http.errorToString(httpCode));
    }
    http.end();
    return false;
  }
}
