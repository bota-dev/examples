import { BotaDeviceClient } from "@bota.dev/web-app-sdk";
const serial = document.querySelector<HTMLInputElement>("#serial")!;
const output = document.querySelector<HTMLPreElement>("#output")!;
const connect = document.querySelector<HTMLButtonElement>("#connect")!;
const status = document.querySelector<HTMLButtonElement>("#status")!;
const disconnect = document.querySelector<HTMLButtonElement>("#disconnect")!;
try {
  const client = await BotaDeviceClient.create();
  connect.disabled = !client.devices.isSupported;
  output.textContent = client.devices.isSupported
    ? "Ready. Enter your exact device serial."
    : "Web Bluetooth is unavailable. Use desktop Chromium on HTTPS or localhost.";
  let busy = false;
  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    busy = true;
    connect.disabled = status.disabled = disconnect.disabled = true;
    try {
      output.textContent =
        JSON.stringify(await action(), null, 2) ?? "Disconnected.";
    } catch {
      output.textContent =
        "Operation failed. Check the selected serial, Bluetooth, and firmware compatibility.";
    } finally {
      busy = false;
      const connected = !!client.devices.connectedDevice;
      connect.disabled = connected;
      status.disabled = disconnect.disabled = !connected;
    }
  }
  connect.onclick = () => {
    if (!serial.value.trim()) {
      output.textContent = "Enter the device serial.";
      return;
    }
    void run(() =>
      client.devices.connect({ expectedSerialNumber: serial.value.trim() }),
    );
  };
  status.onclick = () => void run(() => client.devices.readSnapshot());
  disconnect.onclick = () => void run(() => client.devices.disconnect());
  window.addEventListener("pagehide", () => {
    void client.destroy();
  });
} catch {
  output.textContent =
    "SDK initialization failed. Check the browser console and package installation.";
}
