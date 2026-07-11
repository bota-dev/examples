# Bota Example Backend

Small customer-owned backend for the mobile SDK example. It keeps your Bota API key on the server and exposes mobile-friendly routes for device provisioning and recording upload.

## Run

```bash
cp .env.example .env
npm install
npm run dev
```

Set `BOTA_END_USER_ID` to the test end user that should own demo devices and recordings.
