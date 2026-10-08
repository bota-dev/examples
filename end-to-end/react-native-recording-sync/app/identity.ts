export async function connectVerified<D, C extends { serialNumber: string }>(
  manager: {
    connect(device: D): Promise<C>;
    disconnect(device: C): Promise<void>;
  },
  device: D,
  expectedSerial: string,
): Promise<C> {
  const expected = expectedSerial.trim();
  if (!expected) throw new Error("Enter the serial printed on your device.");
  const connected = await manager.connect(device);
  if (connected.serialNumber !== expected) {
    await manager.disconnect(connected);
    throw new Error("Selected device serial does not match. Disconnected.");
  }
  return connected;
}

export const pairingNotConfirmed = "Paired state was not confirmed. Access is blocked. Check the device and its existing application's setup, then reconnect; no reset or rebind was performed.";

/** The ConnectedDevice flag is a default, not a live pairing read. */
export async function verifyPaired<C>(
  access: {
    isProvisioned(device: C): Promise<boolean>;
    disconnect(device: C): Promise<void>;
  },
  device: C,
  current: () => boolean,
  rejectAccess: () => void,
): Promise<boolean> {
  let paired = false;
  try { paired = await access.isProvisioned(device); }
  catch { /* A failed read cannot admit the device or expose native errors. */ }
  if (!current()) return false;
  if (paired) return true;
  rejectAccess();
  try { await access.disconnect(device); }
  catch { /* Access stays blocked even if transport cleanup fails. */ }
  return false;
}
