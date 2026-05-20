# ⚡ NeuroSync ESP32 Firmware (Phase 4)

C++ firmware for the NodeMCU-32S that reads physiological sensors, buffers 10-second data windows, and transmits them to the NeuroSync backend for real-time stress analysis.

## 🔌 Hardware Requirements

| Component | Model | Connection | ESP32 Pin |
|---|---|---|---|
| Pulse/BVP Sensor | MAX30102 | I2C | SDA → GPIO 21, SCL → GPIO 22 |
| Skin Conductance | GSR Module | Analog | Signal → GPIO 34 |
| Skin Temperature | DS18B20 | OneWire | Data → GPIO 15 (+ 4.7kΩ pull-up to 3.3V) |
| Factory Reset | Tactile Button | Digital | BOOT button (GPIO 0) |

### Wiring Diagram

```
ESP32 NodeMCU-32S
┌──────────────────┐
│                  │
│  GPIO 21 (SDA) ──┼──── MAX30102 SDA
│  GPIO 22 (SCL) ──┼──── MAX30102 SCL
│  3.3V ───────────┼──── MAX30102 VIN
│  GND ────────────┼──── MAX30102 GND
│                  │
│  GPIO 34 ────────┼──── GSR Signal Out
│  3.3V ───────────┼──── GSR VCC
│  GND ────────────┼──── GSR GND
│                  │
│  GPIO 15 ────────┼──┬─ DS18B20 Data
│  3.3V ───────────┼──┤  (4.7kΩ pull-up between Data & 3.3V)
│  GND ────────────┼──┴─ DS18B20 GND
│                  │
└──────────────────┘
```

## 🚀 Getting Started

### Prerequisites
- [PlatformIO](https://platformio.org/) (CLI or VS Code extension)
- An ESP32 NodeMCU-32S board connected via USB

### 1. Configure the Server URL

Edit `include/config.h` and set your production backend URL:

```c
#define SERVER_URL "https://your-app.vercel.app"
```

For **local development**, override it in `platformio.ini` build flags instead:
```ini
build_flags =
    -DARDUINO_ARCH_ESP32
    -DSERVER_URL='"http://192.168.1.100:3000"'
```

### 2. Build & Flash

```bash
# Build only (verify compilation)
pio run

# Build and upload to connected ESP32
pio run --target upload

# Open serial monitor (115200 baud)
pio device monitor
```

### 3. First-Boot Provisioning

On first boot (or after a factory reset), the ESP32 will:

1. **Broadcast a WiFi network** named `NeuroSync-Setup`
2. Connect to it from your phone — a captive portal will open automatically
3. **Select your WiFi network** from the scanned list and enter the password
4. **Paste the Device Token** — copy it from the NeuroSync Dashboard (Devices tab → Register Device → Copy Token)
5. Press **Save** — the ESP32 stores everything to flash, connects to WiFi, and starts streaming

> **Factory Reset:** Hold the BOOT button for 5 seconds during startup to wipe all stored credentials and re-enter provisioning mode.

## 📡 Data Pipeline

Every **10 seconds**, the firmware:

1. Fills three sensor buffers concurrently:
   - **BVP** (MAX30102 IR): 100 Hz → 1000 samples
   - **GSR** (Analog): 10 Hz → 100 samples
   - **Temperature** (DS18B20): 1 Hz → 10 samples

2. Serializes the buffers into a JSON payload:
   ```json
   {
     "bvp_window": [1000 floats],
     "gsr_window": [100 floats],
     "temp_window": [10 floats]
   }
   ```

3. POSTs to `<SERVER_URL>/api/ingest` with `Authorization: Bearer <device_token>`

4. The backend processes the data through the ML pipeline and the result appears on the dashboard within seconds.

## 📁 Project Structure

```
firmware/
├── platformio.ini          # PlatformIO config & library dependencies
├── include/
│   ├── config.h            # Pin assignments, sampling rates, server URL
│   ├── sensors.h           # Sensor read function declarations
│   ├── sampler.h           # Triple-rate buffer management
│   ├── api_client.h        # HTTP POST client
│   └── provisioning.h      # WiFiManager captive portal
├── src/
│   ├── main.cpp            # setup() + loop() orchestrator
│   ├── sensors.cpp         # MAX30102, GSR, DS18B20 drivers
│   ├── sampler.cpp         # micros()-based concurrent sampling
│   ├── api_client.cpp      # ArduinoJson serialization + HTTP
│   └── provisioning.cpp    # Captive portal + Preferences flash storage
└── .gitignore
```

## 📦 Dependencies (auto-installed by PlatformIO)

| Library | Version | Purpose |
|---|---|---|
| [WiFiManager](https://github.com/tzapu/WiFiManager) | 2.x | Captive portal for WiFi + token provisioning |
| [SparkFun MAX3010x](https://github.com/sparkfun/SparkFun_MAX3010x_Sensor_Library) | 1.1.x | I2C driver for MAX30102 pulse sensor |
| [DallasTemperature](https://github.com/milesburton/Arduino-Temperature-Control-Library) | 4.x | DS18B20 temperature sensor |
| [OneWire](https://github.com/PaulStoffregen/OneWire) | 2.x | OneWire protocol (DS18B20 dependency) |
| [ArduinoJson](https://arduinojson.org/) | 7.x | JSON serialization for API payloads |

## 🔧 Troubleshooting

| Issue | Solution |
|---|---|
| `MAX30102 not found` | Check I2C wiring (SDA/SCL). Ensure 3.3V power, not 5V. |
| `DS18B20 not found` | Verify 4.7kΩ pull-up resistor between Data and 3.3V. |
| `WiFi lost` | The firmware auto-reconnects every 10s. Check router range. |
| `HTTP 401` | Device token is invalid or missing. Factory reset and re-provision. |
| `HTTP 503` | ML microservice is down. Check that it's running on the server. |
| Captive portal won't open | Try navigating to `192.168.4.1` manually in your browser. |

## 📊 Build Stats

```
RAM:   [==        ]  17.4% (57 KB / 320 KB)
Flash: [========  ]  82.7% (1.08 MB / 1.31 MB)
```
