import { useEffect, useRef, useState } from 'react';
import { Button, PermissionsAndroid, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import {
  BotaClient, BotaDeviceSDK,
  type BotaEncryptedUploadV2PendingRecording,
  type ConnectedDevice, type DiscoveredDevice,
} from '@bota.dev/react-native-app-sdk';
import * as nativeUpload from './modules/recording-sync';
import { backendOrigin, backendRequest, validateContext, type BackendContext, type Transcription } from './backend';
import { connectVerified } from './identity';
import { OperationScope, waitForPoll, configureNativeScope } from './lifecycle';

type CloudRecording = { id: string; status: string };

export default function App() {
  const [origin, setOrigin] = useState('http://127.0.0.1:8787');
  const [token, setToken] = useState('');
  const [context, setContext] = useState<BackendContext | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [candidates, setCandidates] = useState<DiscoveredDevice[]>([]);
  const [device, setDevice] = useState<ConnectedDevice | null>(null);
  const [recordings, setRecordings] = useState<BotaEncryptedUploadV2PendingRecording[]>([]);
  const [cloud, setCloud] = useState<CloudRecording[]>([]);
  const [transcript, setTranscript] = useState('');
  const [message, setMessage] = useState('Start the backend, forward port 8787 with adb, then enter its application token.');
  const scope = useRef(new OperationScope()).current;
  const active = useRef(true);
  const configured = useRef(false);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      scope.invalidate();
      void nativeUpload.dispose().catch(() => {});
      BotaClient.destroy();
    };
  }, [scope]);

  async function run(action: (operation: ReturnType<OperationScope['begin']>) => Promise<void>) {
    let operation: ReturnType<OperationScope['begin']>;
    try { operation = scope.begin(); } catch { return; }
    setBusy(true);
    try { await action(operation); }
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

  async function loadCloud(signal: AbortSignal, bindingGeneration = context?.bindingGeneration) {
    const result = await backendRequest<{recordings: CloudRecording[]}>(origin, token, '/api/recordings', 'GET', signal, bindingGeneration);
    if (!Array.isArray(result.recordings) || result.recordings.some(r => !/^rec_[A-Za-z0-9]+$/.test(r.id))) {
      throw new SafeError('Backend returned invalid recording metadata.');
    }
    return result.recordings;
  }

  async function authorize() {
    await run(async operation => {
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
        configured.current = true;
        BotaClient.devices.on('deviceDiscovered', candidate => {
          if (active.current) setCandidates(old => [...old.filter(d => d.id !== candidate.id), candidate]);
        });
        BotaClient.devices.on('connectionStateChanged', (_id, state) => {
          if (!active.current || state !== 'disconnected') return;
          scope.invalidate();
          setDevice(null); setRecordings([]);
          setMessage('Disconnected. Upload state is retained. Restore Bluetooth, scan, reconnect and list recordings to resume.');
        });
        BotaClient.on('bluetoothStateChanged', state => {
          if (!active.current) return;
          setReady(state === 'poweredOn');
          if (state !== 'poweredOn') { scope.invalidate(); setDevice(null); setRecordings([]); }
        });
      }
        }, () => active.current && operation.current(), () => nativeUpload.dispose(),
      );
      if (!committed) return;
      setContext(authorized); setReady(BotaClient.isBluetoothReady);
      setMessage(`Authorized device ${authorized.serialNumber}. Scan and verify its identity.`);
      const rows = await loadCloud(operation.signal, authorized.bindingGeneration);
      if (operation.current()) setCloud(rows);
    });
  }

  async function listRecordings(operation: ReturnType<OperationScope['begin']>, selected: ConnectedDevice) {
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
      setMessage(`Verified cloud completion and device confirmation finished${cloudRecordingId ? `: ${cloudRecordingId}` : ''}. Transcription is a separate step.`);
      setRecordings(old => old.filter(r => r.uuid !== recording.uuid || r.generation !== recording.generation));
      const rows = await loadCloud(operation.signal);
      if (operation.current()) setCloud(rows);
    });
  }

  async function transcribe(recordingId: string) {
    await run(async operation => {
      setTranscript(''); setMessage('Requesting transcription for the verified cloud recording.');
      let result = await backendRequest<Transcription>(origin, token, `/api/recordings/${recordingId}/transcription`, 'POST', operation.signal, context?.bindingGeneration);
      const deadline = Date.now() + 5 * 60_000;
      while (operation.current()) {
        if (result.recordingId !== recordingId || !/^txn_[A-Za-z0-9]+$/.test(result.id)) throw new SafeError('Transcription identity did not match.');
        if (result.status === 'completed') { setTranscript(result.text ?? ''); setMessage('Transcription complete.'); return; }
        if (['failed', 'cancelled'].includes(result.status)) throw new SafeError('Transcription failed. Cloud audio remains retained.');
        if (Date.now() >= deadline) throw new SafeError('Polling timed out. The server retains the transcription ID; select Transcribe again to check the same job.');
        setMessage(`Transcription: ${result.status}`);
        await waitForPoll(operation.signal);
        result = await backendRequest<Transcription>(origin, token, `/api/transcriptions/${result.id}`, 'GET', operation.signal, context?.bindingGeneration);
      }
    });
  }

  return <ScrollView contentContainerStyle={{padding: 24, paddingTop: 54, gap: 12}}>
    <Text style={{fontSize: 26, fontWeight: 'bold'}}>Encrypted recording sync</Text>
    <Text>Android · already-provisioned device · encrypted upload only. Choose a consented recording: successful verified sync removes its device copy.</Text>
    <TextInput accessibilityLabel="Backend origin" value={origin} onChangeText={setOrigin} editable={!busy && !context} autoCapitalize="none" autoCorrect={false} style={{borderWidth: 1, padding: 10}} />
    <TextInput accessibilityLabel="Application access token" placeholder="Separate backend application token" value={token} onChangeText={setToken} editable={!busy && !context} secureTextEntry autoCapitalize="none" autoCorrect={false} style={{borderWidth: 1, padding: 10}} />
    <Button title="Authorize and enable Bluetooth" onPress={() => void authorize()} disabled={busy || !!context} />
    {context && <Text>Device: {context.serialNumber} · binding {context.bindingGeneration}</Text>}
    <Button title="Scan for 10 seconds" disabled={!context || !ready || busy || !!device} onPress={() => void run(async operation => {
      setCandidates([]); await BotaClient.devices.startScan({timeout: 10000});
      if (operation.current()) setMessage('Select a device to verify its exact serial.');
    })} />
    {!device && candidates.map(candidate => <View key={candidate.id}><Text>{candidate.name ?? 'Bota device'} · {candidate.rssi} dBm</Text><Button title="Connect and verify" disabled={busy || !context} onPress={() => void run(async operation => {
      BotaClient.devices.stopScan();
      const connected = await connectVerified(BotaClient.devices, candidate, context!.serialNumber);
      if (!operation.current()) { await BotaClient.devices.disconnect(connected); return; }
      setDevice(connected); setCandidates([]); setMessage(`Verified ${connected.serialNumber}. List recordings next.`);
    })} /></View>)}
    <Button title="List encrypted recordings" disabled={!device || busy} onPress={() => void run(op => listRecordings(op, device!))} />
    {recordings.map(recording => <View key={`${recording.uuid}:${recording.generation}`}><Text>{recording.uuid} · generation {recording.generation} · {recording.durationMs / 1000}s</Text><Button title="Sync selected recording" disabled={busy || !device} onPress={() => void sync(recording)} /></View>)}
    <Button title="Disconnect" disabled={!device || busy} onPress={() => void run(async () => {
      try { await BotaClient.devices.disconnect(device!); }
      finally { if (active.current) { setDevice(null); setRecordings([]); } }
    })} />
    <Button title="Stop current operation" disabled={!busy} onPress={() => { scope.invalidate(); setMessage('Stopping locally. Retained upload and cloud work can be reconciled later.'); }} />
    <Text accessibilityLiveRegion="polite">{message}</Text>
    <Button title="Refresh cloud recordings" disabled={!context || busy} onPress={() => void run(async op => { const rows = await loadCloud(op.signal); if (op.current()) setCloud(rows); })} />
    {cloud.map(recording => <View key={recording.id}><Text>{recording.id} · {recording.status}</Text><Button title="Transcribe or check existing job" disabled={busy} onPress={() => void transcribe(recording.id)} /></View>)}
    {!!transcript && <Text selectable>{transcript}</Text>}
  </ScrollView>;
}

class SafeError extends Error {}
