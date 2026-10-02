import assert from 'node:assert/strict';
import test from 'node:test';
import { backendOrigin, backendRequest, validateContext } from './backend.ts';

test('app credentials only go to HTTPS or loopback, without URL credentials or paths', () => {
  assert.equal(backendOrigin('http://127.0.0.1:8787'), 'http://127.0.0.1:8787');
  assert.equal(backendOrigin('https://example.test'), 'https://example.test');
  for (const url of ['http://192.168.1.4:8787', 'https://user:secret@example.test', 'https://example.test/api', 'https://example.test/?token=x']) {
    assert.throws(() => backendOrigin(url));
  }
});

test('invalid server binding scope is rejected before device work', () => {
  const context = {deviceId:'dev_test',endUserId:'eu_test',projectId:'prj_test',serialNumber:'4KF6NOHWX0',bindingGeneration:1};
  assert.deepEqual(validateContext(context), context);
  assert.throws(() => validateContext({...context,bindingGeneration:0}));
  assert.throws(() => validateContext({...context,deviceId:'other'}));
});

test('upstream failure bodies and signed URLs are not exposed as errors', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('secret signed URL', {status:403});
  try {
    await assert.rejects(backendRequest('http://127.0.0.1:8787','app-token','/api/context'), error => {
      assert.match(error.message,/403/);
      assert.doesNotMatch(error.message,/secret/);
      return true;
    });
  } finally { globalThis.fetch = original; }
});

test('authorized resource requests carry the exact observed binding generation', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers['X-Bota-Binding-Generation'], '7');
    assert.equal(options.redirect, 'error');
    return Response.json({recordings: []});
  };
  try {
    await backendRequest('http://127.0.0.1:8787','app-token','/api/recordings','GET',undefined,7);
  } finally { globalThis.fetch = original; }
});
