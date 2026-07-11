# Bota Examples

Example apps for integrating Bota devices, `@bota.dev/react-native-sdk`, and the Bota backend API.

## Packages

| Package | Purpose |
| --- | --- |
| `apps/backend` | Customer-owned Express backend that keeps the Bota API key server-side and proxies device registration, recording grants, upload info, transcription, and summary routes. |
| `apps/react-native` | Expo React Native app that initializes the SDK, scans/connects to a Bota device, reads status, starts/stops device recording, lists device recordings, provisions a token, and syncs recordings through the backend. |

## Quick Start

Use Node 20+.

```bash
cd examples
npm install
cp apps/backend/.env.example apps/backend/.env
npm run dev:backend
npm run dev:react-native
```

The React Native app expects `EXPO_PUBLIC_EXAMPLE_API_URL` to point at the backend. For device builds, use a LAN-accessible URL rather than `localhost`.

## Security Model

Client apps never store a `sk_*` Bota API key. They talk to `apps/backend`, and that backend calls the Bota API with `BOTA_API_KEY`.
