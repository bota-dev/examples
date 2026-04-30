# CLAUDE.md - Bota Examples

This file provides context for Claude Code when working in this repository.

## Repository Overview

This is the **Bota Examples** repository - a collection of example applications demonstrating how to integrate with the Bota platform.

GitHub: https://github.com/bota-dev/examples

## Project Structure

```
examples/
├── react-native/             # React Native mobile app example
│   ├── app/                  # Expo Router screens
│   │   ├── _layout.tsx       # Root layout
│   │   ├── index.tsx         # Entry/splash
│   │   ├── login.tsx         # Authentication
│   │   ├── home.tsx          # Dashboard
│   │   ├── scan.tsx          # Device scanning
│   │   ├── device.tsx        # Device details
│   │   └── recordings.tsx    # Recordings list
│   ├── src/
│   │   ├── api/backend.ts    # Backend API client
│   │   └── context/          # React contexts (Auth, Bota)
│   ├── assets/               # App icons and splash
│   ├── package.json
│   └── tsconfig.json
├── node-backend/             # (future) Node.js backend example
├── python-backend/           # (future) Python backend example
└── CLAUDE.md
```

## React Native Example

### Tech Stack

- **Expo** ~50.0.0 with Expo Router
- **React Native** 0.73.x
- **@bota-dev/react-native-sdk** - Bota SDK from npm
- **react-native-ble-plx** -Bluetoothcommunication

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

**Note:** This app uses nativeBluetoothmodules, so Expo Go won't work. You need:
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
npm update @bota-dev/react-native-sdk
```

## Related Repositories

- `bota-dev/react-native-sdk` - React Native SDK (npm: @bota-dev/react-native-sdk)
- `bota-dev/docs` - API documentation (docs.bota.dev)
- `bota-dev/bota` - Private backend/infrastructure
