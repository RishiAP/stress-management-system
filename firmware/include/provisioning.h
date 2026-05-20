#pragma once

#include <Arduino.h>

/**
 * WiFi & Device Token Provisioning
 *
 * Uses WiFiManager to create a captive portal on first boot.
 * The portal collects WiFi credentials, the backend server URL,
 * and the device token. All values are persisted to ESP32 flash
 * via the Preferences library.
 */

/// Run the provisioning flow.
/// - If stored credentials exist, connects to WiFi automatically.
/// - Otherwise, launches "NeuroSync-Setup" captive portal.
/// Blocks until WiFi is connected.
void runProvisioning();

/// Check if the BOOT button is held for RESET_HOLD_MS during startup.
/// If so, wipe all stored credentials and force re-provisioning.
void checkFactoryReset();

/// Get the stored device token from flash.
/// Returns empty string if not provisioned.
String getDeviceToken();

/// Get the stored server URL from flash.
/// Returns empty string if not provisioned.
String getServerUrl();
