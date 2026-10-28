import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConnectedDevice, DeviceSnapshot } from '@bota.dev/web-app-sdk';
import App from '../../web/App';
import { Devices } from '../../web/features/devices/Devices';
import { DeviceSession, type DeviceClient } from '../../web/features/devices/device-session';

const sdkModule = vi.hoisted(() => ({ loads: 0, create: vi.fn() }));
vi.mock('@bota.dev/web-app-sdk', () => {
  sdkModule.loads += 1;
  return { BotaDeviceClient: { create: sdkModule.create } };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
const identity: ConnectedDevice = {
  id: 'browser-device-a',
  serialNumber: 'SAMPLE123',
  name: 'Wearable',
};
function snapshot(): DeviceSnapshot {
  return {
    identity: {
      serialNumber: identity.serialNumber,
      firmwareRevision: 'sample-firmware',
      modelNumber: null,
      hardwareRevision: null,
    },
    status: {
      batteryPercent: 62,
      batteryMillivolts: null,
      storageTotalMb: 32,
      storageUsedMb: 2,
      state: 'idle',
      pendingRecordings: 0,
      lastTimeSyncTimestamp: 0,
      flags: {
        charging: false,
        lowBattery: false,
        storageFull: false,
        wifiConnected: false,
        lteConnected: false,
        syncActive: false,
      },
      lteStatusRaw: 0,
      lteSignalQuality: null,
      wifiStatusRaw: null,
      modemInfo: null,
    },
    capabilities: { encryptedUploadV2: null },
    capturedAt: new Date('2026-10-20T12:00:00Z'),
  };
}
function fakeClient() {
  let connected: ConnectedDevice | null = null;
  const client = {
    devices: {
      isSupported: true,
      get connectedDevice() {
        return connected;
      },
      connect: vi.fn(async (_options: { expectedSerialNumber: string }) => {
        connected = identity;
        return identity;
      }),
      readSnapshot: vi.fn(async () => snapshot()),
      disconnect: vi.fn(async () => {
        connected = null;
      }),
    },
    destroy: vi.fn(async () => {
      connected = null;
    }),
  } satisfies DeviceClient;
  return {
    client,
    lose: () => {
      connected = null;
    },
    set: (value: ConnectedDevice) => {
      connected = value;
    },
  };
}
const hosts: DeviceSession[] = [];
async function setup(
  options: { mode?: 'demo' | 'live'; supported?: boolean; load?: () => Promise<DeviceClient> } = {},
) {
  const fake = fakeClient();
  const load = vi.fn(options.load ?? (async () => fake.client));
  const host = new DeviceSession(load, () => options.supported !== false);
  hosts.push(host);
  const owner = {};
  host.replaceSession(owner, options.mode ?? 'live');
  await host.waitForCleanup();
  return { host, owner, fake, load };
}
async function connected() {
  const result = await setup();
  await result.host.prepare(result.owner);
  await result.host.connect(result.owner, identity.serialNumber);
  return result;
}
afterEach(async () => {
  cleanup();
  await Promise.all(hosts.splice(0).map((host) => host.closePage()));
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('optional public device session', () => {
  it('keeps the actual SDK module lazy until explicit preparation and supplies no persistence options', async () => {
    const fake = fakeClient();
    sdkModule.create.mockResolvedValueOnce(fake.client);
    const host = new DeviceSession(undefined, () => true);
    hosts.push(host);
    const owner = {};
    host.replaceSession(owner, 'live');
    await host.waitForCleanup();
    expect(sdkModule.loads).toBe(0);
    expect(sdkModule.create).not.toHaveBeenCalled();
    await host.prepare(owner);
    expect(sdkModule.loads).toBe(1);
    expect(sdkModule.create).toHaveBeenCalledWith();
  });

  it('does not load the SDK on construction, session setup, unsupported browsers or demo', async () => {
    for (const options of [{}, { mode: 'demo' as const }, { supported: false }]) {
      const { host, owner, load } = await setup(options);
      expect(load).not.toHaveBeenCalled();
      if (options.mode === 'demo' || options.supported === false) {
        await host.prepare(owner);
        await host.connect(owner, identity.serialNumber);
        expect(load).not.toHaveBeenCalled();
        expect(host.getSnapshot().phase).toBe('unavailable');
      }
    }
  });

  it('prepares separately and invokes the chooser before the first microtask after Connect', async () => {
    const { host, owner, fake, load } = await setup();
    await host.prepare(owner);
    expect(load).toHaveBeenCalledTimes(1);
    const pending = host.connect(owner, ` ${identity.serialNumber} `);
    expect(fake.client.devices.connect).toHaveBeenCalledWith({
      expectedSerialNumber: identity.serialNumber,
    });
    expect(host.getSnapshot().phase).toBe('connecting');
    await pending;
    expect(host.getSnapshot().connection?.serialNumber).toBe(identity.serialNumber);
    expect(fake.client.devices.readSnapshot).not.toHaveBeenCalled();
  });

  it('requires exact serial and rejects a mismatching selected device without displaying identity', async () => {
    const { host, owner, fake } = await setup();
    await host.prepare(owner);
    await host.connect(owner, '');
    await host.connect(owner, 'invalid serial');
    expect(fake.client.devices.connect).not.toHaveBeenCalled();
    await host.connect(owner, 'DIFFERENT123');
    expect(host.getSnapshot().connection).toBeNull();
    expect(fake.client.destroy).toHaveBeenCalledTimes(1);
  });

  it('displays only an explicit current snapshot and refuses a different snapshot serial', async () => {
    const { host, owner, fake } = await connected();
    await host.readStatus(owner);
    expect(host.getSnapshot().status).toMatchObject({
      battery: 62,
      state: 'idle',
      firmware: 'sample-firmware',
    });
    fake.client.devices.readSnapshot.mockResolvedValueOnce({
      ...snapshot(),
      identity: { ...snapshot().identity, serialNumber: 'OTHER123' },
    });
    await host.readStatus(owner);
    expect(host.getSnapshot().connection).toBeNull();
    expect(host.getSnapshot().status).toBeNull();
    expect(fake.client.destroy).toHaveBeenCalled();
  });

  it('clears metadata on observed loss and fences a late status read', async () => {
    const { host, owner, fake } = await connected();
    await host.readStatus(owner);
    const gate = deferred<DeviceSnapshot>();
    fake.client.devices.readSnapshot.mockReturnValueOnce(gate.promise);
    const read = host.readStatus(owner);
    fake.lose();
    host.observeConnection();
    expect(host.getSnapshot().connection).toBeNull();
    expect(host.getSnapshot().status).toBeNull();
    gate.resolve(snapshot());
    await read;
    await host.waitForCleanup();
    expect(host.getSnapshot().connection).toBeNull();
  });

  it('retires rather than adopts an unexpected cached connection identity', async () => {
    const { host, fake } = await connected();
    fake.set({ ...identity, id: 'different-peripheral' });
    host.observeConnection();
    await host.waitForCleanup();
    expect(host.getSnapshot().connection).toBeNull();
    expect(fake.client.devices.readSnapshot).not.toHaveBeenCalled();
  });

  it('clears stale status on SDK error and shows no raw SDK data', async () => {
    const { host, owner, fake } = await connected();
    await host.readStatus(owner);
    fake.client.devices.readSnapshot.mockRejectedValueOnce(
      new Error('private raw transport fields'),
    );
    await host.readStatus(owner);
    expect(host.getSnapshot().connection).toBeNull();
    expect(host.getSnapshot().status).toBeNull();
    expect(host.getSnapshot().message).not.toContain('private');
  });

  it('joins a late chooser and destruction across sign-out and replacement session', async () => {
    const { host, owner, fake, load } = await setup();
    const chooser = deferred<ConnectedDevice>();
    const destroy = deferred<void>();
    fake.client.devices.connect.mockReturnValueOnce(chooser.promise);
    fake.client.destroy.mockReturnValueOnce(destroy.promise);
    await host.prepare(owner);
    const connect = host.connect(owner, identity.serialNumber);
    host.replaceSession(null, 'demo');
    const nextOwner = {};
    host.replaceSession(nextOwner, 'live');
    await host.prepare(nextOwner);
    expect(load).toHaveBeenCalledTimes(1);
    expect(host.getSnapshot().connection).toBeNull();
    let finished = false;
    void host.waitForCleanup().then(() => {
      finished = true;
    });
    destroy.resolve();
    await Promise.resolve();
    expect(finished).toBe(false);
    chooser.resolve(identity);
    await connect;
    await host.waitForCleanup();
    expect(host.getSnapshot().connection).toBeNull();
    await host.connect(owner, identity.serialNumber);
    expect(fake.client.devices.connect).toHaveBeenCalledTimes(1);
    await host.prepare(nextOwner);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('joins a client created after sign-out before permitting new preparation', async () => {
    const fake = fakeClient();
    const initialization = deferred<DeviceClient>();
    const destroy = deferred<void>();
    fake.client.destroy.mockReturnValueOnce(destroy.promise);
    const { host, owner, load } = await setup({ load: () => initialization.promise });
    const prepare = host.prepare(owner);
    const next = {};
    host.replaceSession(next, 'live');
    initialization.resolve(fake.client);
    await prepare;
    await Promise.resolve();
    await host.prepare(next);
    expect(load).toHaveBeenCalledTimes(1);
    expect(fake.client.destroy).toHaveBeenCalledTimes(1);
    destroy.resolve();
    await host.waitForCleanup();
    expect(host.getSnapshot().phase).toBe('idle');
  });

  it('joins explicit disconnect then destroy, retaining a failed cleanup admission gate', async () => {
    const { host, owner, fake, load } = await connected();
    const disconnect = deferred<void>();
    const destroy = deferred<void>();
    fake.client.devices.disconnect.mockReturnValueOnce(disconnect.promise);
    fake.client.destroy.mockReturnValueOnce(destroy.promise);
    const close = host.disconnect(owner);
    expect(host.getSnapshot().connection).toBeNull();
    expect(fake.client.destroy).not.toHaveBeenCalled();
    const next = {};
    host.replaceSession(next, 'live');
    await host.prepare(next);
    expect(load).toHaveBeenCalledTimes(1);
    disconnect.reject(new Error('cleanup failed'));
    await Promise.resolve();
    expect(fake.client.destroy).toHaveBeenCalledTimes(1);
    destroy.resolve();
    await close;
    await host.waitForCleanup();
    expect(host.getSnapshot().phase).toBe('blocked');
    await host.prepare(next);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('blocks replacement after rejected destruction and after page closure', async () => {
    const { host, owner, fake, load } = await connected();
    fake.client.destroy.mockRejectedValueOnce(new Error('private failure'));
    await host.disconnect(owner);
    expect(host.getSnapshot().phase).toBe('blocked');
    host.replaceSession({}, 'live');
    await host.waitForCleanup();
    expect(host.getSnapshot().phase).toBe('blocked');
    await host.closePage();
    await host.prepare(owner);
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe('device UI and recording app ownership', () => {
  it('disables demo and unsupported controls', async () => {
    for (const options of [{ mode: 'demo' as const }, { supported: false }]) {
      const { host, owner, load } = await setup(options);
      const view = render(<Devices devices={host} owner={owner} mode={options.mode ?? 'live'} />);
      for (const button of screen.getAllByRole('button', { hidden: true }))
        expect((button as HTMLButtonElement).disabled).toBe(true);
      expect(load).not.toHaveBeenCalled();
      view.unmount();
    }
  });

  function appFixture() {
    const recording = {
      id: 'rec_browser_sample',
      name: 'Cloud recording sample',
      status: 'uploaded',
      created_at: '2026-10-20T12:00:00Z',
      duration_seconds: 12,
      upload_verified: true,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const path = String(input);
        const value =
          path === '/api/me'
            ? { user: { username: 'alex' }, mode: 'live' }
            : path === '/api/recordings'
              ? { data: [recording], has_more: false, next_cursor: null }
              : path === '/api/recordings/' + recording.id
                ? recording
                : { data: [] };
        return new Response(JSON.stringify(value), {
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
  }

  it('keeps cloud recording navigation available on an unsupported browser without loading the SDK', async () => {
    const { host, load } = await setup({ supported: false });
    appFixture();
    render(<App devices={host} />);
    fireEvent.click(await screen.findByRole('button', { name: /Cloud recording sample/ }));
    await screen.findByRole('heading', { name: 'Cloud recording sample' });
    fireEvent.click(screen.getByRole('button', { name: 'All recordings' }));
    expect(screen.getByRole('heading', { name: /Recordings/ })).toBeTruthy();
    expect(load).not.toHaveBeenCalled();
  });

  it('keeps an explicit device connection independent of recording selection and Back', async () => {
    const { host, fake } = await setup();
    appFixture();
    render(<App devices={host} />);
    await screen.findByRole('heading', { name: 'My recordings' });
    fireEvent.click(screen.getByText('Devices'));
    fireEvent.click(screen.getByRole('button', { name: 'Prepare Bluetooth' }));
    await waitFor(() => expect(host.getSnapshot().phase).toBe('ready'));
    fireEvent.change(screen.getByLabelText('Device serial'), {
      target: { value: identity.serialNumber },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Connect device' }));
    await screen.findByText(identity.serialNumber);
    fireEvent.click(await screen.findByRole('button', { name: /Cloud recording sample/ }));
    await screen.findByRole('heading', { name: 'Cloud recording sample' });
    fireEvent.click(screen.getByRole('button', { name: 'All recordings' }));
    expect(screen.getByText(identity.serialNumber)).toBeTruthy();
    expect(fake.client.destroy).not.toHaveBeenCalled();
  });

  it('uses explicit preparation and connection controls and renders current status', async () => {
    const { host, owner, fake } = await setup();
    render(<Devices devices={host} owner={owner} mode="live" />);
    fireEvent.click(screen.getByText('Devices'));
    fireEvent.click(screen.getByRole('button', { name: 'Prepare Bluetooth' }));
    await waitFor(() => expect(host.getSnapshot().phase).toBe('ready'));
    fireEvent.change(screen.getByLabelText('Device serial'), {
      target: { value: identity.serialNumber },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Connect device' }));
    expect(fake.client.devices.connect).toHaveBeenCalledTimes(1);
    await screen.findByText(identity.serialNumber);
    fireEvent.click(screen.getByRole('button', { name: 'Read status' }));
    await screen.findByText('62%');
    await act(async () => {
      fake.lose();
      host.observeConnection();
      await host.waitForCleanup();
    });
    expect(screen.queryByText(identity.serialNumber)).toBeNull();
    expect(screen.queryByText('62%')).toBeNull();
  });

  it('auth invalidation clears a pending device result before the next account can prepare', async () => {
    const { host, fake, load } = await setup();
    const status = deferred<DeviceSnapshot>();
    const destroy = deferred<void>();
    fake.client.devices.readSnapshot.mockReturnValueOnce(status.promise);
    fake.client.destroy.mockReturnValueOnce(destroy.promise);
    let authorized = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const path = String(input);
        const value =
          path === '/api/me'
            ? { user: { username: 'alex' }, mode: 'live' }
            : path === '/api/recordings'
              ? { data: [], has_more: false, next_cursor: null }
              : { data: [] };
        return new Response(JSON.stringify(value), {
          status: authorized || path === '/api/me' ? 200 : 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
    render(<App devices={host} />);
    await screen.findByRole('heading', { name: 'My recordings' });
    fireEvent.click(screen.getByText('Devices'));
    fireEvent.click(screen.getByRole('button', { name: 'Prepare Bluetooth' }));
    await waitFor(() => expect(host.getSnapshot().phase).toBe('ready'));
    fireEvent.change(screen.getByLabelText('Device serial'), {
      target: { value: identity.serialNumber },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Connect device' }));
    await screen.findByText(identity.serialNumber);
    fireEvent.click(screen.getByRole('button', { name: 'Read status' }));
    authorized = false;
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(screen.queryByText(identity.serialNumber)).toBeNull();
    await act(async () => {
      status.resolve(snapshot());
      destroy.resolve();
      await host.waitForCleanup();
    });
    expect(screen.queryByText('62%')).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
    expect(fake.client.destroy).toHaveBeenCalledTimes(1);
  });
});
