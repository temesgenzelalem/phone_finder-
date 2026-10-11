# Phone Finder — Consent-Based Lost Android Phone Recovery

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Laravel: 13.x](https://img.shields.io/badge/Laravel-13.x-red.svg)](https://laravel.com)
[![Flutter: 3.41+](https://img.shields.io/badge/Flutter-3.41+-02569B.svg)](https://flutter.dev)
[![Next.js: 16.x](https://img.shields.io/badge/Next.js-16.x-black.svg)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20(Neon)-0064a5.svg)](https://neon.tech)
[![Zero Paid APIs](https://img.shields.io/badge/APIs-Zero%20Paid%20APIs%20(OSM)-green.svg)](https://www.openstreetmap.org)

Phone Finder is an Android-first, consent-based phone recovery system engineered to locate and secure lost Android phones without circular authentication dependencies (such as Google 2FA or SMS prompts sent to the lost device).

---

## System Architecture

The solution comprises three interconnected components designed to operate strictly on open-source technologies with **zero paid APIs**:

```
 ┌─────────────────────────────────────────────────────────────┐
 │                Physical Android Phone (Client)               │
 │  Flutter 3.41 + Native Kotlin Android Services              │
 │  • LocationForegroundService (Persistent Notification)       │
 │  • AudioAlarmManager (USAGE_ALARM siren volume override)    │
 │  • PhoneFinderAdminReceiver (DevicePolicyManager.lockNow)    │
 │  • BatteryMonitorReceiver (Low-battery telemetry upload)     │
 └──────────────┬──────────────────────────────▲───────────────┘
                │ Telemetry & ACKs             │ FCM Data Push
                ▼                              │
 ┌─────────────────────────────────────────────┴───────────────┐
 │               Backend API (Laravel 13 & PHP 8.3)             │
 │  • Argon2id (m=64MB, t=3, p=1) Recovery Key Hashing         │
 │  • Constant-time Dummy Verification (Anti-Enumeration)      │
 │  • Seven-Table PostgreSQL Database Schema                    │
 │  • RFC 7519 RS256 OAuth2 Google FCM v1 Service Engine       │
 └──────────────▲──────────────────────────────┬───────────────┘
                │ Authentication & Commands    │ Device Telemetry
                │                              ▼
 ┌──────────────┴─────────────────────────────────────────────┐
 │            Emergency Web Console (Next.js 16 + Leaflet)     │
 │  • Screen 6: High-entropy Recovery Key Login                │
 │  • Screen 7: Interactive Leaflet / OpenStreetMap Console    │
 │  • Live Command Dispatcher (Siren, Lock Screen, Locate)     │
 │  • Temporary In-Memory Session Wipe on Browser Close        │
 └─────────────────────────────────────────────────────────────┘
```

---

## Database Architecture (Seven Tables)

Deployed to PostgreSQL (Neon cloud or local):

1. **`devices`**: Enrolled Android devices with unique Crockford Base32 `phone_tag`, hardware instance ID, battery levels, and telemetry timestamps.
2. **`emergency_credentials`**: Argon2id hashed 12-character recovery key (`PF-XXXX-XXXX-XXXX`, 60 bits entropy) with failed attempt counters and progressive rate-limiting locks.
3. **`device_tokens`**: SHA-256 hashed bearer tokens for authenticating physical phone API requests with automatic rotation.
4. **`locations`**: GPS telemetry history (latitude, longitude, accuracy radius, altitude, battery level, trigger type).
5. **`device_commands`**: Remote emergency recovery commands (`RING`, `LOCK`, `LOCATE`) tracked across states: `PENDING` $\rightarrow$ `DISPATCHED` $\rightarrow$ `DELIVERED` $\rightarrow$ `EXECUTED` / `FAILED` / `EXPIRED`.
6. **`emergency_sessions`**: Ephemeral 15-minute emergency tokens issued to web browsers on borrowed devices.
7. **`audit_logs`**: Append-only audit trail logging security actions, IP addresses, and command executions.

---

## Project Structure

```
phone_finder/
├── backend/            # Laravel 13 REST API
│   ├── app/
│   │   ├── Http/Controllers/Api/  # DeviceController & EmergencyController
│   │   ├── Http/Middleware/       # VerifyDeviceToken & VerifyEmergencyToken
│   │   ├── Jobs/                  # DispatchDeviceCommandJob
│   │   ├── Models/                # Eloquent models with UUID primary keys
│   │   └── Services/              # SecurityService (Argon2id) & FcmService (OAuth2)
│   ├── database/migrations/       # 7 core PostgreSQL migrations
│   └── tests/Feature/             # Complete test suite (20 tests, 142 assertions)
│
├── app/                # Flutter Android Application
│   ├── android/app/src/main/kotlin/com/phonefinder/app/
│   │   ├── MainActivity.kt               # MethodChannel handler
│   │   ├── LocationForegroundService.kt  # Foreground GPS tracker
│   │   ├── AudioAlarmManager.kt          # USAGE_ALARM maximum siren
│   │   ├── PhoneFinderAdminReceiver.kt   # Device Admin screen lock
│   │   └── BatteryMonitorReceiver.kt     # Low-battery broadcast receiver
│   ├── lib/
│   │   ├── screens/   # Onboarding, Permissions, Enrollment, Dashboard, AuditLog
│   │   ├── services/  # ApiService, HardwareService, StorageService
│   │   └── utils/     # RecoveryKeyGenerator (Crockford Base32)
│   └── test/          # Flutter unit & widget tests
│
└── web/                # Next.js Emergency Web Console
    ├── src/
    │   ├── app/        # App Router, Layout, Tailwind CSS
    │   ├── components/ # EmergencyLogin (Screen 6), EmergencyConsole (Screen 7), EmergencyMap (Leaflet)
    │   ├── lib/        # API client with same-origin rewrites
    │   └── types/      # Strongly-typed emergency TypeScript interfaces
    └── next.config.ts  # Turbopack build & backend API reverse proxy
```

---

## Quick Start & Verification

### 1. Backend (Laravel 13)
```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan test
```

### 2. Physical Android Client (Flutter)
```bash
cd app
flutter pub get
flutter analyze
flutter test
# Connect physical Android device via USB with USB debugging enabled:
adb reverse tcp:8000 tcp:8000
flutter run -d <device_id>
```

### 3. Emergency Web Console (Next.js)
```bash
cd web
npm install
npm run build
npm run dev
# Open http://localhost:3000 in any browser
```

---

## Research Hypotheses & Evaluation (H1–H3)

All three research hypotheses are covered by automated benchmarks in [`backend/tests/Feature/EndToEndLifecycleAndResearchHypothesesTest.php`](backend/tests/Feature/EndToEndLifecycleAndResearchHypothesesTest.php):

* **Hypothesis H1 (Telemetry Ingestion Overhead & Battery Awareness)**: Validates that telemetry processing takes `< 50ms` per payload and safely records `LOW_BATTERY` broadcast triggers without blocking system shutdown.
* **Hypothesis H2 (Command Lifecycle & Idempotency)**: Validates strict state transitions (`PENDING` $\rightarrow$ `DISPATCHED` $\rightarrow$ `DELIVERED` $\rightarrow$ `EXECUTED`), 5-minute TTL expiration, and duplicate command deduplication.
* **Hypothesis H3 (Constant-Time Anti-Enumeration & Argon2id Security)**: Validates that nonexistent Phone Tags execute a dummy Argon2id calculation with matching generic error messages, neutralizing timing oracle enumeration attacks.
