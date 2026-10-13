import { useEffect, useRef, useState } from 'react';
import { Button, PermissionsAndroid, Platform, ScrollView, Text, View } from 'react-native';
import {
  BotaClient, BotaDeviceSDK,
  type BotaEncryptedUploadV2PendingRecording,
  type ConnectedDevice, type DiscoveredDevice,
} from '@bota.dev/react-native-app-sdk';
import * as nativeUpload from './modules/recording-sync';
import { backendOrigin, backendRequest, validateContext, type BackendContext } from './backend';
import { connectVerified, pairingNotConfirmed, verifyPaired } from './identity';
import { OperationScope, configureNativeScope } from './lifecycle';
import { deviceSessions } from './device-session';

export default function DeviceSync({ initialOrigin = 'http://127.0.0.1:8787', initialToken = '', onClose }: {
  initialOrigin?: string; initialToken?: string; onClose: () => void;
}) {
  const origin = initialOrigin;
  const token = initialToken;
  const [closing, setClosing] = useState(false);
  const [context, setContext] = useState<BackendContext | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [candidates, setCandidates] = useState<DiscoveredDevice[]>([]);
  const [device, setDevice] = useState<ConnectedDevice | null>(null);
  const [recordings, setRecordings] = useState<BotaEncryptedUploadV2PendingRecording[]>([]);
  const [message, setMessage] = useState('Enable device access to verify the backend-authorized device and request Bluetooth permission.');
  const scope = useRef(new OperationScope()).current;
  const active = useRef(true);
  const configured = useRef(false);
  const connectionIssue = useRef<string | null>(null);
  const lifetime = useRef<ReturnType<typeof deviceSessions.create> | null>(null);

  function sessionOwner() {
    lifetime.current ??= deviceSessions.create({
      disposeHost: () => nativeUpload.dispose(), destroySdk: () => BotaClient.destroy(),
    });
    return lifetime.current;
  }

  function disposeSession() {
    active.current = false;
    scope.invalidate();
    const owner = lifetime.current;
    lifetime.current = null;
    configured.current = false;
    return owner?.close() ?? Promise.resolve();
  }

  useEffect(() => {
    active.current = true;
    return () => {
      void disposeSession().catch(() => {});
    };
  }, [scope]);

  async function run(action: (operation: ReturnType<OperationScope['begin']>) => Promise<void>) {
    if (closing || !active.current) return;
    let operation: ReturnType<OperationScope['begin']>;
    try { operation = scope.begin(); } catch { return; }
    setBusy(true);
    try { await sessionOwner().run(() => action(operation)); }
    catch (error) {
      if (active.current && operation.current()) {
        // Native errors can carry network context; only show this example's safe message.
        setMessage(error instanceof SafeError ? error.message : 'Operation stopped. Check device capability, backend setup and retained upload state before retrying.');
      }
    } finally {
      operation.finish();
      if (active.current) setBusy(false);
    }
  }

  async function authorize() {
    await run(async operation => {
      const owner = sessionOwner();
      if (Platform.OS !== 'android') throw new SafeError('This example supports Android only.');
      const baseUrl = backendOrigin(origin);
      const authorized = validateContext(await backendRequest<BackendContext>(baseUrl, token, '/api/context', 'GET', operation.signal));
      if (!operation.current()) return;
      const permissions = Number(Platform.Version) >= 31
        ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
        : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
      const grants = await PermissionsAndroid.requestMultiple(permissions);
      if (!operation.current()) return;
      if (permissions.some(p => grants[p] !== PermissionsAndroid.RESULTS.GRANTED)) throw new SafeError('Bluetooth permission is required.');
      const committed = await configureNativeScope(
        () => nativeUpload.configure({baseUrl, appToken: token, ...authorized}),
        async () => {
      if (!configured.current) {
        await BotaClient.configure({environment: 'production', logLevel: 'none'});
        if (!active.current || !operation.current() || lifetime.current !== owner) return;
        configured.current = true;
        BotaClient.devices.on('deviceDiscovered', candidate => {
          if (active.current && lifetime.current === owner) setCandidates(old => [...old.filter(d => d.id !== candidate.id), candidate]);
        });
        BotaClient.devices.on('connectionStateChanged', (_id, state) => {
          if (!active.current || lifetime.current !== owner || state !== 'disconnected') return;
          scope.invalidate();
          setDevice(null); setRecordings([]);
          setMessage(connectionIssue.current ?? 'Disconnected. Upload state is retained. Restore Bluetooth, scan, reconnect and list recordings to resume.');
        });
        BotaClient.on('bluetoothStateChanged', state => {
          if (!active.current || lifetime.current !== owner) return;
          setReady(state === 'poweredOn');
          if (state !== 'poweredOn') { scope.invalidate(); setDevice(null); setRecordings([]); }
        });
      }
        }, () => active.current && operation.current(), () => nativeUpload.dispose(),
      );
      if (!committed) return;
      setContext(authorized); setReady(BotaClient.isBluetoothReady);
      setMessage(`Authorized device ${authorized.serialNumber}. Scan and verify its identity.`);
    });
  }

  async function checkPairing(operation: ReturnType<OperationScope['begin']>, selected: ConnectedDevice) {
    return verifyPaired({
      isProvisioned: device => BotaDeviceSDK.controls.isProvisioned(device),
      disconnect: device => BotaClient.devices.disconnect(device),
    }, selected, () => active.current && operation.current(), () => {
      connectionIssue.current = pairingNotConfirmed;
      setDevice(null); setRecordings([]); setMessage(pairingNotConfirmed);
    });
  }

  async function listRecordings(operation: ReturnType<OperationScope['begin']>, selected: ConnectedDevice) {
    if (!await checkPairing(operation, selected) || !operation.current()) return;
    const pending = await BotaDeviceSDK.recordings.listPendingRecordings(selected);
    if (!operation.current()) return;
    const encrypted = pending.filter((r): r is BotaEncryptedUploadV2PendingRecording => 'storageFormat' in r && r.storageFormat === 3);
    setRecordings(encrypted);
    setMessage(`${encrypted.length} encrypted recordings available. ${pending.length - encrypted.length} legacy recordings excluded.`);
  }

  async function sync(recording: BotaEncryptedUploadV2PendingRecording) {
    if (!device || !context) return;
    const selected = device;
    await run(async operation => {
      const fresh = validateContext(await backendRequest<BackendContext>(origin, token, '/api/context', 'GET', operation.signal));
      if (fresh.deviceId !== context.deviceId || fresh.bindingGeneration !== context.bindingGeneration || fresh.endUserId !== context.endUserId || fresh.projectId !== context.projectId || fresh.serialNumber !== selected.serialNumber) {
        throw new SafeError('Device ownership changed. Restart the app and authorize again.');
      }
      if (!operation.current()) return;
      if (!await checkPairing(operation, selected) || !operation.current()) return;
      const status = await BotaClient.devices.getStatus(selected);
      if (!operation.current()) return;
      if (status.flags.syncActive !== false) throw new SafeError('The device may be uploading directly. Wait for fresh inactive status before Bluetooth sync.');
      if (status.state !== 'idle') throw new SafeError('Wait for the device to report idle before starting Bluetooth sync.');
      let operationId: string | undefined;
      let cloudRecordingId: string | undefined;
      setMessage('Preparing encrypted upload. Source cleanup waits for a verified receipt.');
      try {
        await BotaDeviceSDK.recordings.syncEncryptedRecordingV2(selected, {
          uuid: recording.uuid, generation: recording.generation,
          ciphertextLength: recording.ciphertextLength, ciphertextSha256: recording.ciphertextSha256,
          plaintextLength: recording.plaintextLength, storageFormat: 3,
          startedAtMs: String(recording.startedAt.getTime()), durationMs: String(recording.durationMs),
        }, async request => {
          operationId = request.operationId;
          const decision = await nativeUpload.prepare(request);
          cloudRecordingId = decision.cloudRecordingId;
          return decision;
        }, progress => {
          if (active.current && operation.current()) setMessage(`Upload: ${progress.phase} (${progress.completedBytes}/${progress.totalBytes} bytes)`);
        }, {signal: operation.signal});
      } finally {
        if (operationId) await nativeUpload.cancel(operationId);
      }
      if (!operation.current()) return;
      setMessage(`Verified cloud completion and device confirmation finished${cloudRecordingId ? `: ${cloudRecordingId}` : ''}. Return to the library for Transcript, Summary and Ask.`);
      setRecordings(old => old.filter(r => r.uuid !== recording.uuid || r.generation !== recording.generation));
    });
  }

  const blocked = closing || !active.current;
  return <ScrollView contentContainerStyle={{padding: 24, paddingTop: 54, gap: 12}}>
    <Button title={closing ? 'Closing device connection…' : 'Back to recordings'} disabled={closing} onPress={() => {
      setClosing(true);
      void disposeSession().then(onClose).catch(() => {
        setClosing(false);
        setMessage('Device cleanup could not finish. Restart the app before connecting again; upload journals are retained.');
      });
    }} />
    <Text style={{fontSize: 26, fontWeight: 'bold'}}>Device recordings</Text>
    <Text>Android · already-provisioned device · encrypted upload only. Choose a consented recording: successful verified sync removes its device copy.</Text>
    <Button title="Enable device access" onPress={() => void authorize()} disabled={busy || !!context || blocked} />
    {context && <Text>Device: {context.serialNumber} · binding {context.bindingGeneration}</Text>}
    <Button title="Scan for 10 seconds" disabled={!context || !ready || busy || !!device || blocked} onPress={() => void run(async operation => {
      setCandidates([]); await BotaClient.devices.startScan({timeout: 10000});
      if (operation.current()) setMessage('Select a device to verify its exact serial.');
    })} />
    {!device && candidates.map(candidate => <View key={candidate.id}><Text>{candidate.name ?? 'Bota device'} · {candidate.rssi} dBm</Text><Button title="Connect and verify" disabled={busy || !context || blocked} onPress={() => void run(async operation => {
      BotaClient.devices.stopScan();
      connectionIssue.current = null;
      const connected = await connectVerified(BotaClient.devices, candidate, context!.serialNumber);
      if (!operation.current()) { await BotaClient.devices.disconnect(connected); return; }
      const paired = await checkPairing(operation, connected);
      if (!operation.current()) {
        // This operation still owns admission; rejected pairing already attempted cleanup.
        if (!connectionIssue.current) await BotaClient.devices.disconnect(connected);
        return;
      }
      if (!paired) return;
      setDevice(connected); setCandidates([]); setMessage(`Verified ${connected.serialNumber} and fresh paired state. List recordings next.`);
    })} /></View>)}
    <Button title="List encrypted recordings" disabled={!device || busy || blocked} onPress={() => void run(op => listRecordings(op, device!))} />
    {recordings.map(recording => <View key={`${recording.uuid}:${recording.generation}`}><Text>{recording.uuid} · generation {recording.generation} · {recording.durationMs / 1000}s</Text><Button title="Sync selected recording" disabled={busy || !device || blocked} onPress={() => void sync(recording)} /></View>)}
    <Button title="Disconnect" disabled={!device || busy || blocked} onPress={() => void run(async () => {
      try { await BotaClient.devices.disconnect(device!); }
      finally { if (active.current) { setDevice(null); setRecordings([]); } }
    })} />
    <Button title="Stop current operation" disabled={!busy || blocked} onPress={() => { scope.invalidate(); setMessage('Stopping locally. Retained upload and cloud work can be reconciled later.'); }} />
    <Text accessibilityLiveRegion="polite">{message}</Text>
  </ScrollView>;
}

class SafeError extends Error {}
