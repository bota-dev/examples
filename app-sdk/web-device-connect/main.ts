import { BotaDeviceClient } from "@bota.dev/web-app-sdk";
import { createDevicePage } from "./page.ts";
const serial = document.querySelector<HTMLInputElement>("#serial")!;
const output = document.querySelector<HTMLPreElement>("#output")!;
const connect = document.querySelector<HTMLButtonElement>("#connect")!;
const status = document.querySelector<HTMLButtonElement>("#status")!;
const disconnect = document.querySelector<HTMLButtonElement>("#disconnect")!;
let page: ReturnType<typeof createDevicePage> | undefined;
let observation: number | undefined;
let hidden = false;
window.addEventListener("pagehide", () => {
  hidden = true;
  window.clearInterval(observation);
  if (page) void page.close();
  else {
    connect.disabled = status.disabled = disconnect.disabled = serial.disabled = true;
    output.textContent = "Bluetooth closed. Reload this page to connect again.";
  }
}, { once: true });
try {
  const client = await BotaDeviceClient.create();
  if (hidden) {
    // Initialization can finish after pagehide; never attach that client to the page.
    await client.destroy().catch(() => undefined);
  } else {
    page = createDevicePage(client, (message, controls) => {
      output.textContent = message;
      connect.disabled = controls.connectDisabled;
      status.disabled = controls.readDisabled;
      disconnect.disabled = controls.disconnectDisabled;
      serial.disabled = controls.serialDisabled;
    });
    connect.onclick = () => { void page?.connect(serial.value); };
    status.onclick = () => { void page?.readStatus(); };
    disconnect.onclick = () => { void page?.disconnect(); };
    // beta.13 has no public connection subscription. This reads a local SDK getter,
    // never a GATT characteristic, and performs no automatic reconnect.
    observation = window.setInterval(page.observeConnection, 250);
  }
} catch {
  if (!hidden) {
    output.textContent =
      "SDK initialization failed. Check the browser console and package installation.";
  }
}
