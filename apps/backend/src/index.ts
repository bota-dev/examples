import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  BOTA_API_BASE_URL: z.string().url().default('https://api.bota.dev/v1'),
  BOTA_API_KEY: z.string().min(1),
  BOTA_END_USER_ID: z.string().min(1),
});

const env = envSchema.parse(process.env);
const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

class BotaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly data: unknown
  ) {
    super(message);
    this.name = 'BotaApiError';
  }
}

async function bota<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${env.BOTA_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.BOTA_API_KEY}`,
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const message =
      typeof data?.error === 'string'
        ? data.error
        : data?.error?.message ?? data?.message ?? `Bota API returned ${response.status}`;
    throw new BotaApiError(message, response.status, data);
  }

  return data as T;
}

const deviceTypeToModel = {
  bota_pin: 'bota_pin',
  bota_pin_4g: 'bota_pin',
  bota_note: 'bota_note',
} as const;

const registerDeviceSchema = z.object({
  serialNumber: z.string().min(1),
  deviceType: z.enum(['bota_pin', 'bota_pin_4g', 'bota_note']),
  name: z.string().min(1).optional(),
  pkD: z.string().regex(/^[0-9a-f]{128}$/).optional().nullable(),
});

const bindDeviceSchema = z.object({
  pkD: z.string().regex(/^[0-9a-f]{128}$/).optional().nullable(),
});

const uploadInfoSchema = z.object({
  uuid: z.string().min(1),
  startedAt: z.string().datetime().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  fileSizeBytes: z.number().int().positive().optional(),
  codec: z.string().optional(),
  deviceSerialNumber: z.string().min(1).optional(),
});

const completeUploadSchema = z.object({
  duration_seconds: z.number().int().positive().optional(),
  file_size_bytes: z.number().int().positive().optional(),
  content_sha256: z.string().regex(/^[0-9a-f]{64}$/).optional(),
});

const recordingGrantSchema = z.object({
  nonce_d: z.string().optional(),
});

async function findDeviceBySerialNumber(serialNumber: string): Promise<any | null> {
  const page = await bota<{ data?: any[] }>('/devices?limit=100');
  return page.data?.find((device) => device.serial_number === serialNumber) ?? null;
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/recordings', async (_req, res, next) => {
  try {
    const recordings = await bota('/recordings?limit=20');
    res.json(recordings);
  } catch (error) {
    next(error);
  }
});

app.post('/api/devices/register', async (req, res, next) => {
  try {
    const input = registerDeviceSchema.parse(req.body);
    const device =
      (await findDeviceBySerialNumber(input.serialNumber)) ??
      (await bota<any>('/devices', {
        method: 'POST',
        body: JSON.stringify({
          serial_number: input.serialNumber,
          model: deviceTypeToModel[input.deviceType],
          name: input.name ?? input.serialNumber,
        }),
      }));

    const bound = await bota<any>(`/devices/${device.id}/bind`, {
      method: 'POST',
      body: JSON.stringify({
        end_user_id: env.BOTA_END_USER_ID,
        pk_d: input.pkD ?? undefined,
      }),
    });

    res.status(201).json({
      deviceId: bound.id,
      serialNumber: bound.serial_number,
      token: bound.device_token,
      cert: bound.cert,
      blePubkey: bound.ble_pubkey,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/devices/:deviceId/token', async (req, res, next) => {
  try {
    const input = bindDeviceSchema.parse(req.body);
    const bound = await bota<any>(`/devices/${req.params.deviceId}/bind`, {
      method: 'POST',
      body: JSON.stringify({
        end_user_id: env.BOTA_END_USER_ID,
        pk_d: input.pkD ?? undefined,
      }),
    });

    res.json({
      deviceId: bound.id,
      token: bound.device_token,
      cert: bound.cert,
      blePubkey: bound.ble_pubkey,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/devices/:deviceId/recording-grant', async (req, res, next) => {
  try {
    const input = recordingGrantSchema.parse(req.body);
    const grant = await bota(`/devices/${req.params.deviceId}/grant`, {
      method: 'POST',
      body: JSON.stringify(input.nonce_d ? { nonce_d: input.nonce_d } : {}),
    });

    res.json(grant);
  } catch (error) {
    next(error);
  }
});

app.post('/api/recordings/upload-info', async (req, res, next) => {
  try {
    const input = uploadInfoSchema.parse(req.body);
    const recordedAt = input.startedAt ?? new Date().toISOString();
    const recording = await bota<any>('/recordings', {
      method: 'POST',
      body: JSON.stringify({
        end_user_id: env.BOTA_END_USER_ID,
        name: `Bota recording ${recordedAt}`,
        recorded_at: recordedAt,
        source: 'device',
        upload_method: 'ble',
        metadata: {
          device_recording_uuid: input.uuid,
          device_serial_number: input.deviceSerialNumber,
          codec: input.codec,
        },
      }),
    });

    const upload = await bota<any>(`/recordings/${recording.id}/upload-url`, {
      method: 'POST',
      body: JSON.stringify({
        content_type: 'audio/ogg',
        file_size_bytes: input.fileSizeBytes,
      }),
    });

    res.status(201).json({
      recordingId: recording.id,
      uploadUrl: upload.upload_url,
      uploadToken: upload.upload_token,
      completeUrl: `${req.protocol}://${req.get('host')}/api/recordings/${recording.id}/upload-complete`,
      expiresAt: upload.expires_at,
      contentType: 'audio/ogg',
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/recordings/:recordingId/upload-complete', async (req, res, next) => {
  try {
    const input = completeUploadSchema.parse(req.body);
    const recording = await bota<any>(`/recordings/${req.params.recordingId}/upload-complete`, {
      method: 'POST',
      body: JSON.stringify(input),
    });

    const transcription = await bota<any>('/transcriptions', {
      method: 'POST',
      body: JSON.stringify({ recording_id: req.params.recordingId }),
    }).catch((error) => ({ error: error.message }));

    res.json({ recording, transcription });
  } catch (error) {
    next(error);
  }
});

app.post('/api/transcriptions/:transcriptionId/summaries', async (req, res, next) => {
  try {
    const prompt =
      typeof req.body?.prompt === 'string' && req.body.prompt.length >= 10
        ? req.body.prompt
        : 'Summarize this recording into concise notes with action items.';
    const summary = await bota('/summaries', {
      method: 'POST',
      body: JSON.stringify({
        transcription_id: req.params.transcriptionId,
        prompt,
      }),
    });

    res.status(201).json(summary);
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: 'Invalid request', details: error.flatten() });
    return;
  }

  if (error instanceof BotaApiError) {
    res.status(error.status).json({ error: error.message, details: error.data });
    return;
  }

  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(env.PORT, () => {
  console.log(`Bota example backend listening on http://localhost:${env.PORT}`);
});
