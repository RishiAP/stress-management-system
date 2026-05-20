# Next.js Application Stack and Responsibilities

Technology stack:

* Next.js full-stack application
* Clerk for user authentication and session management
* shadcn/ui for frontend UI components
* Supabase PostgreSQL as primary database
* Prisma ORM for database access

Repository structure overview:

```text id="p9mv7q"
stress-management-system/
│
├── app/          # Next.js full-stack app (frontend + main backend)
├── ml/           # WESAD preprocessing, training, experimentation
├── ml-service/   # FastAPI ML inference microservice
├── firmware/     # future ESP32 PlatformIO firmware
├── docs/
└── README.md
```

Current implementation scope:

The current development phase should focus ONLY on:

* Next.js full-stack application
* backend orchestration layer
* authentication system
* realtime infrastructure
* database architecture
* FastAPI ML microservice integration
* frontend dashboard architecture

Firmware implementation should NOT be built yet.

The `firmware/` folder currently represents a future development phase only and should be considered at a high architectural level during planning.

Planned future firmware responsibilities:

* sensor acquisition
* buffering/windowing
* device-token authentication
* sending sensor data batches to backend APIs

Prisma configuration:

* direct database URL used in Prisma schema/config
* pooled database connection URL used in Next.js Prisma client/lib

Authentication architecture:

* Clerk handles frontend/user authentication and sessions
* ESP32 devices use separate device-token authentication
* ESP32 devices do NOT use Clerk authentication directly
* device tokens are validated by the Next.js backend before processing requests

Main Next.js responsibilities:

* user authentication and session management
* device registration and device-token management
* DASS-21 questionnaire handling and storage
* receiving sensor data from ESP32 devices
* validating ESP32 device tokens
* forwarding sensor windows to FastAPI ML microservice
* storing prediction history and user data
* realtime frontend updates using WebSockets/Socket.IO
* API validation and access control
* orchestration layer between:

  * ESP32 devices
  * ML microservice
  * frontend dashboard
  * database

Realtime monitoring requirements:

The system should support realtime monitoring of:

* heart rate
* stress score
* GSR trends
* temperature trends
* historical charts
* device connection status

Realtime architecture decision:

* ESP32 devices should send periodic authenticated sensor data batches to the Next.js backend
* Next.js backend should communicate internally with the FastAPI ML microservice
* FastAPI microservice handles:

  * preprocessing
  * HRV extraction
  * feature engineering
  * stress prediction
* Next.js backend stores prediction results and emits realtime updates using WebSockets/Socket.IO
* frontend dashboard listens for socket events and updates UI live

Recommended realtime flow:

ESP32
→ sends authenticated sensor windows to Next.js backend
→ backend validates device token
→ backend forwards sensor data to FastAPI ML microservice
→ ML microservice returns prediction results
→ backend stores latest metrics/results
→ backend emits realtime socket events
→ frontend dashboard updates live charts and indicators

Recommended realtime technologies:

* Socket.IO or WebSockets for frontend live updates
* frontend should NOT communicate directly with ESP32 devices
* backend acts as centralized realtime hub/orchestrator

Important architectural decision:

* ESP32 devices are only responsible for:

  * sensor acquisition
  * buffering
  * authenticated data transmission

* Heavy processing should occur in backend services:

  * HRV extraction
  * preprocessing
  * feature engineering
  * ML inference
  * DASS-21 fusion
  * realtime orchestration
