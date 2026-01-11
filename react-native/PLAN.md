# Bota React Native SDK Example

This example app demonstrates how to integrate the `@bota-dev/react-native-sdk` into a React Native app.

## Purpose

Show developers how to:
1. Initialize the SDK
2. Scan for Bota devices via Bluetooth
3. Connect to a device
4. Read device info and status
5. Handle provisioning (pattern only - requires backend token)

## Screens

### 1. Devices Tab (Home)
- SDK initialization status
- "Scan for Devices" button
- List of discovered devices
- Connect/disconnect functionality
- Connected device info (serial, firmware, battery)

### 2. Device Detail Screen
- Device info (serial number, firmware version, hardware revision)
- Real-time status (battery, storage, recording state)
- Provisioning section (shows code pattern, needs token from backend)
- Disconnect button

## Implementation Tasks

- [x] Set up Expo 54 with tabs template
- [x] Install @bota-dev/react-native-sdk
- [x] Basic device scanning on home tab
- [ ] Improve Devices tab UI
- [ ] Add Device Detail screen
- [ ] Show device status (battery, storage)
- [ ] Add provisioning UI with code comments
- [ ] Add error handling and loading states
- [ ] Update tab icons and names

## Not Included (Requires Backend)

- Actual device provisioning (needs device token from your backend)
- Recording sync/upload
- Transcription/summary display

See [docs.bota.dev](https://docs.bota.dev) for full integration guide including backend setup.
