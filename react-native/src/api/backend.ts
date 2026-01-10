/**
 * Mock Backend API
 *
 * In a real app, these would call your actual backend.
 * The backend then calls the Bota API with your secret key.
 */

import type {DeviceRecording, UploadInfo} from '@bota/react-native-sdk';

// Simulated API base URL
const API_BASE = 'https://api.yourcompany.com';

/**
 * Register a device with your backend
 * Your backend would call POST /v1/devices on the Bota API
 */
export async function registerDevice(params: {
  serialNumber: string;
  deviceType: string;
  firmwareVersion: string;
  endUserId: string;
}): Promise<{deviceId: string; deviceToken: string}> {
  console.log('[MockAPI] Registering device:', params);

  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 500));

  // In production, your backend would:
  // 1. Call Bota API: POST /v1/devices with your sk_live_* key
  // 2. Return the device_id and device_token

  return {
    deviceId: `dev_demo_${Date.now()}`,
    deviceToken: `dtok_demo_${Math.random().toString(36).substring(2)}`,
  };
}

/**
 * Create a recording and get upload info
 * Your backend would call POST /v1/recordings and POST /v1/recordings/:id/upload-url
 */
export async function createRecording(params: {
  deviceId: string;
  recording: DeviceRecording;
}): Promise<UploadInfo> {
  console.log('[MockAPI] Creating recording:', params);

  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 500));

  const recordingId = `rec_demo_${Date.now()}`;

  // In production, your backend would:
  // 1. Call Bota API: POST /v1/recordings
  // 2. Call Bota API: POST /v1/recordings/:id/upload-url
  // 3. Return the upload info

  return {
    recordingId,
    uploadUrl: `https://bota-demo-uploads.s3.amazonaws.com/${recordingId}?X-Amz-Algorithm=...`,
    uploadToken: `up_demo_${Math.random().toString(36).substring(2)}`,
    completeUrl: `${API_BASE}/recordings/${recordingId}/complete`,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
  };
}

/**
 * Notify backend that upload is complete
 * Your backend would call POST /v1/recordings/:id/complete on the Bota API
 */
export async function completeRecording(params: {
  recordingId: string;
  uploadToken: string;
}): Promise<void> {
  console.log('[MockAPI] Completing recording:', params);

  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 300));

  // In production, your backend would:
  // Call Bota API: POST /v1/recordings/:id/complete
}

/**
 * Report device status to your backend
 */
export async function reportDeviceStatus(params: {
  deviceId: string;
  batteryLevel: number;
  storageUsedPercent: number;
  pendingRecordings: number;
}): Promise<void> {
  console.log('[MockAPI] Reporting device status:', params);

  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 200));
}
