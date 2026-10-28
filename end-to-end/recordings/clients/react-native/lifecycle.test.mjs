import assert from 'node:assert/strict';
import test from 'node:test';
import { OperationScope, waitForPoll, configureNativeScope } from './lifecycle.ts';

test('loss fences late successes and errors but does not start competing work before teardown', () => {
  const scope = new OperationScope();
  const pending = scope.begin();
  assert.equal(pending.current(), true);
  scope.invalidate();
  assert.equal(pending.signal.aborted, true);
  assert.equal(pending.current(), false);
  assert.throws(() => scope.begin(), /stop/);
  pending.finish();
  const replacement = scope.begin();
  pending.finish();
  assert.equal(replacement.current(), true);
  assert.throws(() => scope.begin());
  replacement.finish();
});

test('cancelling transcription polling stops the local wait', async () => {
  const controller = new AbortController();
  const pending = waitForPoll(controller.signal, 60000);
  controller.abort();
  await assert.rejects(pending, /Cancelled/);
});

test('failed SDK setup disposes the partial native authorization before retry', async () => {
  let configured = false;
  const setup = async () => { assert.equal(configured, false); configured = true; };
  const dispose = async () => { configured = false; };
  await assert.rejects(configureNativeScope(setup, async () => { throw Error('SDK failure'); }, () => true, dispose));
  assert.equal(configured, false);
  assert.equal(await configureNativeScope(setup, async () => {}, () => true, dispose), true);
  assert.equal(configured, true);
});

test('cancellation during native authorization cleans up without initializing SDK', async () => {
  let disposed = false;
  const committed = await configureNativeScope(async () => {}, async () => assert.fail('retired setup'), () => false, async () => { disposed = true; });
  assert.equal(committed, false);
  assert.equal(disposed, true);
});
