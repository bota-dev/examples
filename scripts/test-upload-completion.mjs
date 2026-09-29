import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../apps/react-native/src/api.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { getUploadInfo } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const recording = {
  uuid: '00112233-4455-6677-8899-aabbccddeeff',
  startedAt: new Date('2026-09-28T00:00:00Z'),
  durationMs: 1500,
  fileSizeBytes: 100,
  codec: 'opus_16k',
};

test('completion binds the allocated recording and forwards native byte evidence', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url, init });
    return Response.json(calls.length === 1
      ? { recordingId: 'rec_example', uploadUrl: 'https://storage.example/object' }
      : { recording: { id: 'rec_example' } });
  });
  const upload = await getUploadInfo(recording, { serialNumber: 'EXAMPLE' });
  const controller = new AbortController();
  await upload.complete({ fileSizeBytes: 96, contentSha256: 'a'.repeat(64), signal: controller.signal });
  assert.ok(calls[1].url.endsWith('/api/recordings/rec_example/upload-complete'));
  assert.equal(calls[1].init.signal, controller.signal);
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    file_size_bytes: 96, content_sha256: 'a'.repeat(64), duration_seconds: 1.5,
  });
});

test('backend completion rejection remains a rejected SDK callback', async (t) => {
  let count = 0;
  t.mock.method(globalThis, 'fetch', async () => ++count === 1
    ? Response.json({ recordingId: 'rec_example', uploadUrl: 'https://storage.example/object' })
    : Response.json({ error: 'Upload is not durable yet' }, { status: 425 }));
  const upload = await getUploadInfo(recording, { serialNumber: 'EXAMPLE' });
  await assert.rejects(upload.complete({ fileSizeBytes: 96, signal: new AbortController().signal }), /not durable/);
});
