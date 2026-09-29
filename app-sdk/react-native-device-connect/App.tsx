import { useEffect, useRef, useState } from "react";
import {
  Button,
  PermissionsAndroid,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  BotaClient,
  type ConnectedDevice,
  type DiscoveredDevice,
} from "@bota.dev/react-native-app-sdk";
import { connectVerified } from "./identity";

export default function App() {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [serial, setSerial] = useState("");
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [device, setDevice] = useState<ConnectedDevice | null>(null);
  const [message, setMessage] = useState("Initializing Bluetooth…");
  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        if (Platform.OS === "android") {
          const permissions =
            Number(Platform.Version) >= 31
              ? [
                  PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                  PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                ]
              : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
          const grants = await PermissionsAndroid.requestMultiple(permissions);
          if (
            permissions.some(
              (p) => grants[p] !== PermissionsAndroid.RESULTS.GRANTED,
            )
          )
            throw new Error("Bluetooth permissions are required.");
        }
        if (!active) return;
        await BotaClient.configure({
          environment: "production",
          logLevel: "error",
        });
        if (!active) {
          BotaClient.destroy();
          return;
        }
        BotaClient.devices.on("deviceDiscovered", (d) => {
          if (active)
            setDevices((old) => [...old.filter((x) => x.id !== d.id), d]);
        });
        BotaClient.devices.on("connectionStateChanged", (_id, state) => {
          if (active && state === "disconnected") setDevice(null);
        });
        BotaClient.on("bluetoothStateChanged", (state) => {
          if (active) {
            setReady(state === "poweredOn");
            if (state !== "poweredOn") setDevice(null);
          }
        });
        setReady(BotaClient.isBluetoothReady);
        setMessage("Enter the exact serial printed on your device, then scan.");
      } catch {
        if (active)
          setMessage(
            "Initialization failed. Check Bluetooth and application permissions.",
          );
      }
    }
    void initialize();
    return () => {
      active = false;
      BotaClient.destroy();
    };
  }, []);
  async function run(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Operation failed");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  return (
    <ScrollView
      contentContainerStyle={{ padding: 24, paddingTop: 60, gap: 14 }}
    >
      <Text style={{ fontSize: 28, fontWeight: "bold" }}>Connect to Bota</Text>
      <Text>
        Read-only discovery and device status. No API key or backend required.
      </Text>
      <TextInput
        accessibilityLabel="Expected device serial"
        placeholder="Exact device serial"
        autoCapitalize="none"
        autoCorrect={false}
        value={serial}
        onChangeText={setSerial}
        editable={!busy && !device}
        style={{ borderWidth: 1, padding: 12 }}
      />
      <Button
        title="Scan for 10 seconds"
        disabled={!ready || busy || !!device}
        onPress={() =>
          void run(async () => {
            setDevices([]);
            await BotaClient.devices.startScan({ timeout: 10000 });
          })
        }
      />
      {!device &&
        devices.map((candidate) => (
          <View key={candidate.id}>
            <Text>
              {candidate.name} · {candidate.rssi} dBm
            </Text>
            <Button
              title="Connect and verify serial"
              disabled={busy || !serial.trim()}
              onPress={() =>
                void run(async () => {
                  BotaClient.devices.stopScan();
                  const connected = await connectVerified(
                    BotaClient.devices,
                    candidate,
                    serial,
                  );
                  setDevice(connected);
                  setMessage(`Verified serial: ${connected.serialNumber}`);
                })
              }
            />
          </View>
        ))}
      {device && (
        <>
          <Button
            title="Read status"
            disabled={busy}
            onPress={() =>
              void run(async () => {
                setMessage(
                  JSON.stringify(
                    await BotaClient.devices.getStatus(device),
                    null,
                    2,
                  ),
                );
              })
            }
          />
          <Button
            title="Disconnect"
            disabled={busy}
            onPress={() =>
              void run(async () => {
                await BotaClient.devices.disconnect(device);
                setDevice(null);
                setMessage("Disconnected.");
              })
            }
          />
        </>
      )}
      <Text selectable accessibilityLiveRegion="polite">
        {message}
      </Text>
    </ScrollView>
  );
}
