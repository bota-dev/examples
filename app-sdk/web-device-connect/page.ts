type Connection = { id: string; serialNumber: string };

// Only the published facade methods used by this sample are needed here.
export interface DeviceClient {
  devices: {
    readonly isSupported: boolean;
    readonly connectedDevice: Connection | null;
    connect(options: { expectedSerialNumber: string }): Promise<Connection>;
    readSnapshot(): Promise<unknown>;
    disconnect(): Promise<void>;
  };
  destroy(): Promise<void>;
}

export interface Controls {
  connectDisabled: boolean;
  readDisabled: boolean;
  disconnectDisabled: boolean;
  serialDisabled: boolean;
}

const sameConnection = (left: Connection | null, right: Connection | null) =>
  left?.id === right?.id && left?.serialNumber === right?.serialNumber;

export function createDevicePage(
  client: DeviceClient,
  render: (message: string, controls: Controls) => void,
) {
  let connection: Connection | null = null;
  let revision = 0;
  let busy = false;
  let closed = false;
  let message = client.devices.isSupported
    ? "Ready. Enter your exact device serial."
    : "Web Bluetooth is unavailable. Use desktop Chromium on HTTPS or localhost.";

  function display() {
    render(message, {
      connectDisabled: closed || busy || !client.devices.isSupported || connection !== null,
      readDisabled: closed || busy || connection === null,
      disconnectDisabled: closed || busy || connection === null,
      serialDisabled: closed || busy || connection !== null,
    });
  }

  function observeConnection() {
    if (closed) return;
    const next = client.devices.connectedDevice;
    if (sameConnection(next, connection)) return;
    connection = next ? { id: next.id, serialNumber: next.serialNumber } : null;
    revision += 1;
    message = connection
      ? "Identity verified. Read status for a fresh device snapshot."
      : "Connection lost. Previous device metadata cleared; connect again explicitly.";
    display();
  }

  async function run(kind: "connect" | "read" | "disconnect", serial = "") {
    if (closed || busy || !client.devices.isSupported) return;
    observeConnection();
    if (kind !== "connect" && !connection) return;
    if (kind === "connect" && (connection || !serial)) {
      if (!connection) { message = "Enter the device serial."; display(); }
      return;
    }
    const startingRevision = revision;
    const startingConnection = connection;
    busy = true;
    message = kind === "disconnect" ? "Disconnecting. Previous device metadata cleared." : "Working…";
    display();
    try {
      // The picker begins before the first await, preserving browser user activation.
      const result = await (kind === "connect"
        ? client.devices.connect({ expectedSerialNumber: serial })
        : kind === "read" ? client.devices.readSnapshot() : client.devices.disconnect());
      if (closed) return;
      observeConnection();
      if (kind === "read" && (revision !== startingRevision ||
          !sameConnection(connection, startingConnection))) return;
      if (kind === "connect" && (!connection || connection.serialNumber !== serial)) return;
      message = JSON.stringify(result, null, 2) ?? "Disconnected. Previous device metadata cleared.";
    } catch {
      if (closed) return;
      observeConnection();
      if (revision === startingRevision) {
        message = "Operation failed. Check the selected serial, Bluetooth, and firmware compatibility.";
      }
    } finally {
      if (!closed) { busy = false; display(); }
    }
  }

  display();
  return {
    connect: (serial: string) => run("connect", serial.trim()),
    readStatus: () => run("read"),
    disconnect: () => run("disconnect"),
    observeConnection,
    close: async () => {
      if (closed) return;
      closed = true;
      revision += 1;
      connection = null;
      message = "Bluetooth closed. Reload this page to connect again.";
      display();
      try { await client.destroy(); } catch { /* The page stays closed if cleanup fails. */ }
    },
  };
}
