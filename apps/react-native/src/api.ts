import type { DeviceRecording, UploadInfo } from '@bota.dev/react-native-sdk';

const API_URL = process.env.EXPO_PUBLIC_EXAMPLE_API_URL ?? 'http://localhost:4000';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    throw new Error(data?.error ?? `Request failed with ${response.status}`);
  }

  return data as T;
}

export async function registerDevice(input: {
  serialNumber: string;
  deviceType: 'bota_pin' | 'bota_pin_4g' | 'bota_note';
}) {
  return request<{ deviceId: string; token: string; cert?: string; blePubkey?: string }>(
    '/api/devices/register',
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );
}

export async function requestRecordingGrant(deviceId: string, nonce_d: string | null) {
  const result = await request<{ grant_blob: string; expires_at: string }>(
    `/api/devices/${deviceId}/recording-grant`,
    {
      method: 'POST',
      body: JSON.stringify(nonce_d ? { nonce_d } : {}),
    }
  );

  return result.grant_blob;
}

export async function getUploadInfo(
  recording: DeviceRecording,
  device: { serialNumber: string }
): Promise<UploadInfo> {
  const result = await request<{
    recordingId: string;
    uploadUrl: string;
    uploadToken?: string;
    completeUrl?: string;
    expiresAt?: string;
    contentType?: string;
  }>('/api/recordings/upload-info', {
    method: 'POST',
    body: JSON.stringify({
      uuid: recording.uuid,
      startedAt: recording.startedAt.toISOString(),
      durationMs: recording.durationMs,
      fileSizeBytes: recording.fileSizeBytes,
      codec: recording.codec,
      deviceSerialNumber: device.serialNumber,
    }),
  });

  return {
    recordingId: result.recordingId,
    uploadUrl: result.uploadUrl,
    uploadToken: result.uploadToken,
    completeUrl: result.completeUrl,
    expiresAt: result.expiresAt ? new Date(result.expiresAt) : undefined,
    contentType: result.contentType,
  };
}

export async function listBackendRecordings() {
  return request('/api/recordings');
}
