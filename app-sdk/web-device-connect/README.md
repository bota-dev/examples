# Connect to a device from the browser

A Vite page using published `@bota.dev/web-app-sdk@2.0.0-beta.8` (beta) to connect, verify an exact serial, read status, and disconnect. No backend or API key.

## Run

Use Node 22.23.2+, npm, and a desktop Chromium browser supporting Web Bluetooth. The page must run in a secure context: localhost works for development; remote hosting requires HTTPS. Safari/Firefox and arbitrary HTTP LAN URLs are not supported by this example. The firmware must expose Bota Identity service `0008` for serial read-back because browsers block standard serial characteristic `2A25`.

```sh
npm ci
npm start
```

Open the local URL printed by Vite. Enter the exact serial printed on your device, click Connect, and choose it in the browser picker. The SDK verifies identity before accepting the connection. The picker starts directly from the click handler; moving it behind an awaited request can lose browser user activation. Use Read status and Disconnect after connecting. No recording or provisioning operations are performed.

If Bluetooth is unsupported, permission is denied, or identity verification fails, the page shows an error. Close other applications using the device. The browser owns permission prompts; inspect site permissions to retry. The SDK is destroyed when the page unloads.

2026-09-30 UTC, beta.8: public frozen install, TypeScript check and Vite/WASM build passed locally and in [CI 36660143423](https://github.com/bota-dev/examples/actions/runs/36660143423). Physical browser Bluetooth acceptance remains unverified. See the [current review](../../docs/independent-examples-review.md#beta8-adoption).

## Verify

```sh
npm run typecheck
npm run build
```

2026-09-29: public package installation, TypeScript check, and Vite 7.3.6 production build (including SDK WASM) pass locally; npm audit reports zero vulnerabilities. Actual browser Bluetooth pairing/status and supported-firmware coverage remain unverified. See [implementation review](../../docs/independent-examples-review.md) for CI evidence and the [SDK reference](https://docs.bota.dev/api-reference/client-sdks).
