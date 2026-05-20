# 🧠 NeuroSync Dashboard (Phase 3)

The central orchestration hub and user interface for the Hybrid Physiological Stress Management System. Built with Next.js 16 (App Router), this application provides real-time monitoring of physiological stress, manages ESP32 hardware provisioning, and computes personalized hybrid stress scores.

## 🚀 Tech Stack
- **Framework**: Next.js 16 (React 19)
- **Database**: PostgreSQL (Supabase) + Prisma ORM
- **Authentication**: Clerk (with Webhook sync)
- **Styling & UI**: Tailwind CSS, shadcn/ui, Lucide Icons
- **Real-time Architecture**: High-frequency Polling with Next.js API Routes

## ✨ Core Features

### 1. Hybrid Stress Scoring
Calculates a highly personalized stress probability (0-100) by combining:
- **Physiological ML Score**: Real-time biometric inference fetched from the FastAPI Microservice.
- **Psychological Baseline**: Uses a baseline psychological questionnaire taken by the user to modify and scale the physiological predictions.

### 2. Live Monitoring Dashboard
A premium, glassmorphism-inspired UI providing real-time insights:
- **Stress Gauge**: An animated SVG arc tracking the live Hybrid Stress Score.
- **Heart Rate Monitor**: Real-time BPM display with a sparkline history.
- **Signal Trends**: Interactive area charts mapping Galvanic Skin Response (μS) and Skin Temperature (°C) over time.

### 3. ESP32 Hardware Provisioning
- Registers custom ESP32 wearable devices.
- Generates secure, 64-character Bearer tokens for hardware authentication.
- Captive-portal-ready token provisioning workflow.

### 4. Seamless Data Pipeline
- `/api/ingest`: High-throughput endpoint secured by Device Tokens (not user cookies) allowing ESP32s to POST arrays of raw sensor data (BVP, GSR, Temp).
- The pipeline automatically triggers feature extraction on the ML Microservice, calculates the hybrid score, persists the data to Supabase, and makes it available to the polling dashboard.

---

## 🛠️ Environment Variables

Copy the `.env.example` to `.env` or set these in your hosting provider (e.g. Vercel):

```env
# Supabase PostgreSQL connection
DATABASE_URL="postgresql://[user]:[password]@[host]:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://[user]:[password]@[host]:5432/postgres"

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"

# Clerk Webhook Secret (for user syncing)
CLERK_WEBHOOK_SECRET="whsec_..."

# ML Microservice Connection
ML_SERVICE_URL="http://localhost:8000"
ML_SERVICE_API_KEY="your_secure_api_key_here"
```

## ⚡ Getting Started

1. **Install dependencies**:
   ```bash
   yarn install
   ```

2. **Initialize Database**:
   Push the Prisma schema to your Supabase PostgreSQL database:
   ```bash
   npx prisma db push
   ```

3. **Start Development Server**:
   ```bash
   yarn dev
   ```
   The application will be available at `http://localhost:3000`.

## 🔒 Security Architecture

- **User Access**: Next.js Middleware (`src/proxy.ts`) strictly protects `/dashboard` and internal APIs. Unauthenticated browser traffic is intercepted at the Edge and redirected to Clerk.
- **Hardware Access**: The ESP32 telemetry endpoint (`/api/ingest`) is explicitly excluded from Clerk middleware. Instead, it expects a `Authorization: Bearer <token>` header containing the 64-character device token.
- **Microservice Access**: All requests from this Next.js app to the FastAPI microservice are signed with the `ML_SERVICE_API_KEY`.
