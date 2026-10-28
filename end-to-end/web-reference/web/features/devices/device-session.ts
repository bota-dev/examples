import type { ConnectedDevice, DeviceSnapshot } from '@bota.dev/web-app-sdk';
import type { Mode } from '../../api';

// The public SDK calls live here; this seam supplies synthetic tests, not a new SDK.
export interface DeviceClient {
  devices: {
    readonly isSupported: boolean;
    readonly connectedDevice: ConnectedDevice | null;
    connect(options: { expectedSerialNumber: string }): Promise<ConnectedDevice>;
    readSnapshot(): Promise<DeviceSnapshot>;
    disconnect(): Promise<void>;
  };
  destroy(): Promise<void>;
}

export async function loadDeviceClient(): Promise<DeviceClient> {
  const { BotaDeviceClient } = await import('@bota.dev/web-app-sdk');
  // Omitting storageNamespace uses public storage=null: no persisted SDK hints/journals.
  return BotaDeviceClient.create();
}

type Phase =
  | 'idle'
  | 'unavailable'
  | 'preparing'
  | 'ready'
  | 'connecting'
  | 'connected'
  | 'reading'
  | 'closing'
  | 'blocked';
export interface DeviceView {
  phase: Phase;
  message: string;
  connection: ConnectedDevice | null;
  status: { battery: number; state: string; firmware: string | null; readAt: string } | null;
}
const unsupported =
  'Bluetooth requires desktop Chromium on HTTPS or localhost. Your recording library is still available.';
const demo =
  'Bluetooth is disabled in demo mode. Sample recordings make no device or SDK requests.';
const sameDevice = (a: ConnectedDevice | null, b: ConnectedDevice | null) =>
  !!a && !!b && a.id === b.id && a.serialNumber === b.serialNumber;

export class DeviceSession {
  private owner: object | null = null;
  private mode: Mode = 'demo';
  private revision = 0;
  private client: DeviceClient | null = null;
  private pending: Promise<unknown> | null = null;
  private cleanup: Promise<void> | null = null;
  private failed = false;
  private unavailable = false;
  private pageClosed = false;
  private observation: ReturnType<typeof setInterval> | undefined;
  private listeners = new Set<() => void>();
  private view: DeviceView = { phase: 'idle', message: demo, connection: null, status: null };

  constructor(
    private readonly load = loadDeviceClient,
    private readonly supported = () =>
      typeof window !== 'undefined' && window.isSecureContext && 'bluetooth' in navigator,
  ) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.view;

  replaceSession(owner: object | null, mode: Mode) {
    if (owner === this.owner && mode === this.mode) return;
    this.owner = owner;
    this.mode = mode;
    void this.retire('Bluetooth session changed. Prepare Bluetooth to start again.');
  }

  private publish(
    phase: Phase,
    message: string,
    connection: ConnectedDevice | null = null,
    status: DeviceView['status'] = null,
  ) {
    this.view = { phase, message, connection, status };
    for (const listener of this.listeners) listener();
  }
  private current(owner: object, revision: number) {
    return this.owner === owner && this.revision === revision && !this.pageClosed;
  }
  private allowed(owner: object) {
    return (
      this.owner === owner &&
      this.mode === 'live' &&
      !this.pageClosed &&
      !this.failed &&
      !this.unavailable &&
      !this.cleanup &&
      this.supported()
    );
  }
  private idle(
    message = 'Prepare Bluetooth, then connect using your exact printed device serial.',
  ) {
    this.publish(
      this.failed || this.pageClosed
        ? 'blocked'
        : this.mode === 'demo' || !this.supported() || this.unavailable
          ? 'unavailable'
          : 'idle',
      this.failed
        ? 'Bluetooth cleanup failed. Reload this page before another device session.'
        : this.pageClosed
          ? 'This page has closed Bluetooth. Reload to use it again.'
          : this.mode === 'demo'
            ? demo
            : !this.supported() || this.unavailable
              ? unsupported
              : message,
    );
  }

  async prepare(owner: object) {
    if (!this.allowed(owner) || this.pending || this.client) return;
    const revision = this.revision;
    this.publish('preparing', 'Preparing Bluetooth…');
    const job = this.load().then((client) => {
      this.client = client;
      return client;
    });
    this.pending = job;
    try {
      const client = await job;
      if (!this.current(owner, revision)) return;
      if (!client.devices.isSupported) {
        this.unavailable = true;
        await this.retire(unsupported);
        return;
      }
      this.publish('ready', 'Enter the exact printed serial, then choose Connect device.');
      // Public facade has no connection subscription. This polls a cached getter, never GATT.
      this.observation = setInterval(this.observeConnection, 250);
    } catch {
      if (this.current(owner, revision))
        this.idle(
          'Bluetooth could not prepare. Check browser support and try Prepare Bluetooth again.',
        );
    } finally {
      if (this.pending === job) this.pending = null;
    }
  }

  async connect(owner: object, input: string) {
    if (!this.allowed(owner) || this.pending || this.view.phase !== 'ready' || !this.client) return;
    const serial = input.trim();
    if (!/^[A-Za-z0-9]{1,64}$/.test(serial)) {
      this.publish('ready', 'Enter the exact device serial (letters and numbers only).');
      return;
    }
    const client = this.client;
    const revision = this.revision;
    this.publish('connecting', 'Choose your device in the Bluetooth picker…');
    // No await/import before this public call: the picker keeps the Connect click's activation.
    const job = client.devices.connect({ expectedSerialNumber: serial });
    this.pending = job;
    try {
      const connection = await job;
      if (!this.current(owner, revision)) return;
      if (
        connection.serialNumber !== serial ||
        !sameDevice(connection, client.devices.connectedDevice)
      ) {
        await this.retire(
          'The selected device identity could not be verified. Prepare Bluetooth to try again.',
        );
        return;
      }
      this.publish(
        'connected',
        'Device identity verified. Choose Read status for a fresh snapshot.',
        { ...connection },
      );
    } catch {
      if (this.current(owner, revision))
        await this.retire(
          'Connection was cancelled or failed. Check serial and device availability, then prepare again.',
        );
    } finally {
      if (this.pending === job) this.pending = null;
    }
  }

  async readStatus(owner: object) {
    if (!this.allowed(owner) || this.pending || !this.client || this.view.phase !== 'connected')
      return;
    const client = this.client;
    const connection = this.view.connection;
    if (!sameDevice(connection, client.devices.connectedDevice)) {
      await this.retire('Connection lost. Previous device information cleared.');
      return;
    }
    const revision = this.revision;
    this.publish('reading', 'Reading device status…', connection);
    const job = client.devices.readSnapshot();
    this.pending = job;
    try {
      const snapshot = await job;
      if (!this.current(owner, revision)) return;
      if (
        !sameDevice(connection, client.devices.connectedDevice) ||
        snapshot.identity.serialNumber !== connection?.serialNumber ||
        !Number.isFinite(snapshot.status.batteryPercent) ||
        snapshot.status.batteryPercent < 0 ||
        snapshot.status.batteryPercent > 100 ||
        !Number.isFinite(snapshot.capturedAt.getTime())
      ) {
        await this.retire(
          'Device status did not match the verified connection. Previous information cleared.',
        );
        return;
      }
      this.publish('connected', 'Status read from the verified device.', connection, {
        battery: snapshot.status.batteryPercent,
        state: snapshot.status.state,
        firmware: snapshot.identity.firmwareRevision,
        readAt: snapshot.capturedAt.toLocaleTimeString(),
      });
    } catch {
      if (this.current(owner, revision))
        await this.retire(
          'Device status failed. Previous information cleared; prepare Bluetooth to try again.',
        );
    } finally {
      if (this.pending === job) this.pending = null;
    }
  }

  observeConnection = () => {
    if (!this.client || !this.view.connection || this.cleanup) return;
    if (!sameDevice(this.view.connection, this.client.devices.connectedDevice))
      void this.retire(
        'Connection lost. Previous device information cleared; reconnect explicitly.',
      );
  };

  disconnect(owner: object) {
    if (!this.allowed(owner) || this.pending || !this.client) return Promise.resolve();
    return this.retire('Disconnected. Prepare Bluetooth before another connection.', true);
  }
  closePage() {
    this.pageClosed = true;
    this.owner = null;
    return this.retire('Bluetooth closed.');
  }
  waitForCleanup() {
    return this.cleanup ?? Promise.resolve();
  }

  private retire(message: string, explicitDisconnect = false): Promise<void> {
    this.revision += 1;
    clearInterval(this.observation);
    this.observation = undefined;
    this.publish('closing', 'Closing Bluetooth. Previous device information cleared.');
    if (this.cleanup) return this.cleanup;
    const client = this.client;
    const pending = this.pending;
    this.client = null;
    const destroy = async (target: DeviceClient) => {
      if (explicitDisconnect) {
        try {
          await target.devices.disconnect();
        } catch {
          this.failed = true;
        }
      }
      try {
        await target.destroy();
      } catch {
        this.failed = true;
      }
    };
    // Start public destruction immediately to retire native work, but also join the
    // pending picker/read and a client which may be created by a late preparation.
    const destruction = client ? destroy(client) : Promise.resolve();
    const cleanup = (async () => {
      await Promise.all([destruction, pending?.catch(() => undefined)]);
      const lateClient = this.client;
      this.client = null;
      if (lateClient && lateClient !== client) await destroy(lateClient);
      this.pending = null;
    })();
    this.cleanup = cleanup;
    void cleanup.then(() => {
      if (this.cleanup === cleanup) {
        this.cleanup = null;
        this.idle(message);
      }
    });
    return cleanup;
  }
}
