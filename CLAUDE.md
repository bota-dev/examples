# CLAUDE.md - Bota Examples

This file provides context for Claude Code when working in this repository.

## Repository Overview

This is the **Bota Examples** repository - a collection of example applications demonstrating how to integrate with the Bota platform.

GitHub: https://github.com/bota-dev/examples

## Implementation Rule

Examples should be reimplemented from public contracts and observed behavior, not copied from private Bota packages. It is fine to read `bota-one`, `demo`, `bota`, and `react-native-sdk` to understand route shapes, SDK APIs, and product flow, but example code must use its own simple structure and should not import, paste, or preserve private app helpers, comments, transforms, auth wrappers, or first-party-only architecture.

## Project Structure

```
examples/
├── apps/
│   ├── backend/              # Express backend example; keeps sk_* API keys server-side
│   │   ├── src/index.ts      # Bota API proxy for devices, recording grants, uploads, transcription, summaries
│   │   ├── .env.example
│   │   └── package.json
│   ├── react-native/         # Expo React Native SDK example
│       ├── app/index.tsx     # Scan/connect/status/recording-control/provision/sync demo
│       ├── src/api.ts        # Calls apps/backend, never Bota API directly
│       └── package.json
│   ├── ios/                  # Future native iOS example
│   └── android/              # Future native Android example
├── package.json              # npm workspace root
├── package-lock.json
├── README.md
└── CLAUDE.md
```

## Monorepo Example

The current first-class example is an npm workspace with:

- `apps/react-native` — Expo 54 / React Native 0.81 app using `@bota.dev/react-native-sdk`
- `apps/backend` — Node 20+ / Express / TypeScript backend that proxies Bota `/v1/*`

Future native client examples should live beside the React Native app as `apps/ios` and `apps/android`, using the same backend contract where possible.

The backend demonstrates the customer-owned glue layer Bota One uses conceptually: mobile calls the customer backend, the backend holds the Bota API key, recording control gets backend-issued grants, and recording sync returns SDK `UploadInfo` with a backend completion URL.

### Running Locally

```bash
cd examples
npm install
cp apps/backend/.env.example apps/backend/.env
npm run dev:backend
EXPO_PUBLIC_EXAMPLE_API_URL=http://localhost:4000 npm run dev:react-native
```

For physical devices, set `EXPO_PUBLIC_EXAMPLE_API_URL` to a LAN-reachable backend URL. Expo Go is not enough because BLE requires native modules; use a development build.

### Verify

```bash
cd examples
npm run typecheck -w @bota-dev/example-backend
npm run typecheck -w @bota-dev/example-react-native
```

Use Node 20+ for install and verification. React Native 0.81 requires a current Node runtime.

The root workspace lock pins transitive `@xmldom/xmldom` to patched 0.8.15
and the nested `plist` copy to patched 0.9.12 within their existing parent
ranges. This changes dependency resolution for a fresh install only; example
source, API-key handling, and published SDK dependencies are unchanged.

### Key Files

- `apps/backend/src/index.ts` - Mobile-facing routes and Bota API proxy calls, including recording grants
- `apps/backend/.env.example` - Required Bota API key and end-user configuration
- `apps/react-native/app/index.tsx` - SDK configure, scan, connect, status read, recording start/stop, recording list, provisioning, sync
- `apps/react-native/src/api.ts` - SDK upload-info provider and device registration client

### Security Boundary

Never put `sk_live_*`, `sk_test_*`, or `rk_*` keys in client apps. Clients only call `apps/backend`; `BOTA_API_KEY` lives in backend environment variables.

## React Native Example

### Tech Stack

- **Expo** ~50.0.0 with Expo Router
- **React Native** 0.73.x
- **@bota.dev/react-native-sdk** - Bota SDK from npm
- **react-native-ble-plx** - BLE communication

### Running Locally

```bash
cd react-native
npm install
npm start           # Start Metro bundler

# For iOS (requires Mac + Xcode)
npm run ios

# For Android (requires Android Studio)
npm run android
```

**Note:** This app uses native BLE modules, so Expo Go won't work. You need:
- `expo prebuild` + native build, OR
- EAS Build for development builds

### Key Files

- `app/scan.tsx` - Device discovery using SDK
- `app/device.tsx` - Device connection and status
- `app/recordings.tsx` - Recording sync flow
- `src/api/backend.ts` - Your backend API integration
- `src/context/BotaContext.tsx` - SDK initialization

### Configuration

The example expects a backend API. Update `src/api/backend.ts` with your API URL:

```typescript
const API_BASE_URL = 'https://your-api.example.com';
```

## Common Tasks

### Adding a New Example

1. Create a new directory (e.g., `node-backend/`)
2. Add README with setup instructions
3. Include `.gitignore` for dependencies/build artifacts
4. Update this CLAUDE.md

### Updating SDK Version

```bash
cd react-native
npm update @bota.dev/react-native-sdk
```

## Related Repositories

- `bota-dev/react-native-sdk` - React Native SDK (npm: @bota.dev/react-native-sdk)
- `bota-dev/docs` - API documentation (docs.bota.dev)
- `bota-dev/bota` - Private backend/infrastructure
