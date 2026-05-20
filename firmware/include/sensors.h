#pragma once

/**
 * Sensor Abstraction Layer
 *
 * Provides initialization and non-blocking read functions for:
 *   - MAX30102 (BVP / IR signal via I2C)
 *   - GSR (analog skin conductance)
 *   - DS18B20 (skin temperature via OneWire)
 */

/// Initialize all three sensors. Call once in setup().
/// Returns false if a critical sensor (MAX30102) fails to initialize.
bool initSensors();

/// Read a single IR value from MAX30102 (proxy for BVP).
/// Returns 0.0 if no finger is detected or sensor error.
float readBVP();

/// Read the GSR analog value and return as a voltage (0.0–3.3V).
float readGSR();

/// Read the DS18B20 temperature in °C.
/// Returns -127.0 on sensor error.
float readTemp();
