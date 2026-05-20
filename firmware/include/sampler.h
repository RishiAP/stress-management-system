#pragma once

/**
 * Triple-Rate Sampler
 *
 * Manages concurrent sampling at three different rates (100Hz, 10Hz, 1Hz)
 * using micros()-based timing. Fills ring buffers and signals when a
 * complete 10-second window is ready for transmission.
 */

/// Initialize sampler state. Call once in setup() after initSensors().
void initSampler();

/// Run one tick of the sampler. Call every iteration of loop().
/// Internally checks elapsed time and samples the appropriate sensors.
void samplerTick();

/// Returns true when all three buffers have been completely filled (10s window ready).
bool isWindowReady();

/// Copy the current window data out for transmission.
/// Resets internal buffer indices so the next window can begin filling.
/// @param bvp   Output array, must be at least BVP_BUFFER_SIZE floats
/// @param gsr   Output array, must be at least GSR_BUFFER_SIZE floats
/// @param temp  Output array, must be at least TEMP_BUFFER_SIZE floats
void getWindow(float* bvp, float* gsr, float* temp);
