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
