# Lovedogs 360

A production-ready mobile application for dog identification (biometrics), management, and service marketplace.

## Architecture
- **Backend**: FastAPI (Python), PostgreSQL, SQLAlchemy.
- **Frontend**: React Native (Expo).
- **AI**: Logic Stub for Nose-Print Biometrics (simulated matching based on attributes + confidence scores).
- **Deployment**: Docker Compose.

## Prerequisites
- Docker & Docker Compose
- Node.js & npm
- Repo cloned locally.

## How to Run

### 1. Start Backend & Database
1. Navigate to `lovedogs360` directory.
2. Run Docker Compose:
   ```bash
   docker-compose up --build
   ```
3. Backend will be available at `http://localhost:8000`.
4. API Docs (Swagger): `http://localhost:8000/docs`.

### 2. Start Frontend (Mobile App)
1. Open a new terminal.
2. Navigate to `lovedogs360/frontend`.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start Expo:
   ```bash
   npm start
   ```
   - Press `a` to run on Android Emulator (ensure it's running).
   - Press `i` for iOS Simulator (macOS only).
   - Scan QR code with Expo Go app on physical device.

**Note**: Since the backend runs in Docker, if you are using an Android Emulator, the API Client in `src/api/client.js` is configured to point to `http://10.0.2.2:8000`. If you run on a physical device, update `BASE_URL` to your machine's LAN IP (e.g., `http://192.168.1.5:8000/api/v1`).

## Features Implemented
- **Owner Registration**: Sign up, login, role selection.
- **Dog Registration**: Name, breed, details, and **Biometric Nose Print** Enrollment (Simulated).
- **AI Matching**: `/identify` endpoint logic to match dogs based on attributes.
- **Service Marketplace**: Foundation API structure.
- **Security**: JWT Authentication.
