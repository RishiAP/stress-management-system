#pragma once

/**
 * API Client
 *
 * Serializes sensor windows to JSON and POSTs them to the
 * Next.js /api/ingest endpoint with Bearer token authentication.
 */

/// Configure the API client with server URL and device token.
/// Call once after provisioning completes.
void initApiClient(const char* serverUrl, const char* deviceToken);

/// Send a complete sensor window to the backend.
/// @returns true on HTTP 200, false on any error
bool sendWindow(const float* bvp, int bvpLen,
                const float* gsr, int gsrLen,
                const float* temp, int tempLen);
