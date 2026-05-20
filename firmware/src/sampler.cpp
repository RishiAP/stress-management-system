#include "sampler.h"
#include "sensors.h"
#include "config.h"

#include <Arduino.h>

// ─── Ring Buffers ───────────────────────────────────────────────────────────
static float bvpBuffer[BVP_BUFFER_SIZE];
static float gsrBuffer[GSR_BUFFER_SIZE];
static float tempBuffer[TEMP_BUFFER_SIZE];

static int bvpIdx = 0;
static int gsrIdx = 0;
static int tempIdx = 0;

static bool bvpFull = false;
static bool gsrFull = false;
static bool tempFull = false;

// ─── Timing ─────────────────────────────────────────────────────────────────
static unsigned long lastBvpUs = 0;
static unsigned long lastGsrUs = 0;
static unsigned long lastTempUs = 0;

void initSampler() {
  bvpIdx = 0;
  gsrIdx = 0;
  tempIdx = 0;
  bvpFull = false;
  gsrFull = false;
  tempFull = false;

  unsigned long now = micros();
  lastBvpUs = now;
  lastGsrUs = now;
  lastTempUs = now;

  Serial.println("[SAMPLER] Initialized — filling " +
                 String(WINDOW_SECONDS) + "s window (" +
                 String(BVP_BUFFER_SIZE) + " BVP, " +
                 String(GSR_BUFFER_SIZE) + " GSR, " +
                 String(TEMP_BUFFER_SIZE) + " Temp samples)");
}

void samplerTick() {
  unsigned long now = micros();

  // ── BVP @ 100 Hz ────────────────────────────────────────────────────────
  if (!bvpFull && (now - lastBvpUs >= BVP_INTERVAL_US)) {
    lastBvpUs += BVP_INTERVAL_US; // drift-corrected timing
    bvpBuffer[bvpIdx++] = readBVP();
    if (bvpIdx >= BVP_BUFFER_SIZE) {
      bvpFull = true;
    }
  }

  // ── GSR @ 10 Hz ─────────────────────────────────────────────────────────
  if (!gsrFull && (now - lastGsrUs >= GSR_INTERVAL_US)) {
    lastGsrUs += GSR_INTERVAL_US;
    gsrBuffer[gsrIdx++] = readGSR();
    if (gsrIdx >= GSR_BUFFER_SIZE) {
      gsrFull = true;
    }
  }

  // ── Temp @ 1 Hz ─────────────────────────────────────────────────────────
  if (!tempFull && (now - lastTempUs >= TEMP_INTERVAL_US)) {
    lastTempUs += TEMP_INTERVAL_US;
    tempBuffer[tempIdx++] = readTemp();
    if (tempIdx >= TEMP_BUFFER_SIZE) {
      tempFull = true;
    }
  }
}

bool isWindowReady() {
  return bvpFull && gsrFull && tempFull;
}

void getWindow(float* bvp, float* gsr, float* temp) {
  // Copy buffers out
  memcpy(bvp, bvpBuffer, BVP_BUFFER_SIZE * sizeof(float));
  memcpy(gsr, gsrBuffer, GSR_BUFFER_SIZE * sizeof(float));
  memcpy(temp, tempBuffer, TEMP_BUFFER_SIZE * sizeof(float));

  // Reset for next window
  bvpIdx = 0;
  gsrIdx = 0;
  tempIdx = 0;
  bvpFull = false;
  gsrFull = false;
  tempFull = false;

  unsigned long now = micros();
  lastBvpUs = now;
  lastGsrUs = now;
  lastTempUs = now;
}
