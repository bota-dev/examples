import { Component, Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { createDemoLibrary } from './demo';
import { createLibraryApi, safeMessage } from './library-api';
import { RecordingsController } from './recordings-controller';
import { Action, LibraryView } from './Recordings';

// Only the explicit live Device action loads SDK/native modules or Bluetooth permissions.
const DeviceSync = lazy(() => import('./DeviceSync'));
type Session = { controller: RecordingsController; mode: 'sample' | 'live'; origin: string; token: string };

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const current = useRef<Session | null>(null);
  const [origin, setOrigin] = useState('http://127.0.0.1:8787');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [deviceOpen, setDeviceOpen] = useState(false);

  useEffect(() => () => { current.current?.controller.dispose(); current.current = null; }, []);
  function reset() {
    current.current?.controller.dispose(); current.current = null;
    setSession(null); setDeviceOpen(false); setOrigin('http://127.0.0.1:8787'); setToken(''); setError('');
  }
  function startSample() {
    const next: Session = { controller: new RecordingsController(createDemoLibrary()), mode: 'sample', origin: '', token: '' };
    current.current?.controller.dispose(); current.current = next;
    setToken(''); setError(''); setSession(next);
  }
  function connect() {
    try {
      let next: Session;
      const api = createLibraryApi(origin, token, () => {
        if (current.current !== next) return;
        reset(); setError('The application token was rejected. Connect again.');
      });
      next = { controller: new RecordingsController(api), mode: 'live', origin: origin.trim(), token: token.trim() };
      current.current?.controller.dispose(); current.current = next;
      setToken(''); setError(''); setSession(next);
    } catch (issue) { setError(safeMessage(issue)); }
  }

  if (session && deviceOpen && session.mode === 'live') return (
    <DeviceBoundary onClose={() => { setDeviceOpen(false); void session.controller.refreshLibrary(); }}>
      <Suspense fallback={<View style={styles.screen}><ActivityIndicator /><Text>Opening device connection…</Text></View>}>
        <DeviceSync initialOrigin={session.origin} initialToken={session.token} onClose={() => {
          setDeviceOpen(false); void session.controller.refreshLibrary();
        }} />
      </Suspense>
    </DeviceBoundary>
  );
  if (session) return <LibraryView controller={session.controller} mode={session.mode} onExit={reset} onDevice={() => {
    if (session.mode !== 'live') return;
    session.controller.back(); setDeviceOpen(true);
  }} />;

  return <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
    <Text accessibilityRole="header" style={styles.title}>Bota Recordings</Text>
    <Text style={styles.description}>A common recording app sample: browse recordings, read transcripts, create notes and ask a question.</Text>
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.heading}>Explore the app</Text>
      <Text>Try two synthetic recordings. No account, device or API key is needed. Nothing is recorded or sent over the network.</Text>
      <Action title="Try sample recordings" onPress={startSample} />
    </View>
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.heading}>Connect your backend</Text>
      <Text>Use the companion server and its separate application token. Keep your Bota project API key on the server.</Text>
      <Text style={styles.label}>Backend origin</Text>
      <TextInput accessibilityLabel="Backend origin" value={origin} onChangeText={setOrigin} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} />
      <Text style={styles.label}>Application token</Text>
      <TextInput accessibilityLabel="Application token" value={token} onChangeText={setToken} secureTextEntry autoCapitalize="none" autoCorrect={false} style={styles.input} />
      <Action title="Connect backend" onPress={connect} />
      <Text style={styles.small}>Credentials stay in memory. The Android Device screen is optional and requires an already-bound, compatible Bota device.</Text>
    </View>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  </ScrollView>;
}

class DeviceBoundary extends Component<{ children: ReactNode; onClose: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.heading}>Device support is unavailable</Text>
      <Text>Build this example's Android native host to connect a Bota device. The cloud recording app remains available.</Text>
      <Action title="Back to recordings" onPress={this.props.onClose} />
    </View>;
  }
}

const styles = StyleSheet.create({
  screen: { padding: 20, paddingTop: 54, gap: 18, backgroundColor: '#f4f6f8', flexGrow: 1 },
  title: { fontSize: 26, fontWeight: '700', color: '#152738' },
  description: { fontSize: 16, lineHeight: 24, color: '#415365' },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d7dfe7', borderRadius: 10, padding: 18, gap: 14 },
  heading: { fontSize: 19, fontWeight: '600', color: '#152738' },
  label: { fontWeight: '600', color: '#152738' },
  input: { minHeight: 46, borderWidth: 1, borderColor: '#8494a4', borderRadius: 6, padding: 12, backgroundColor: '#fff', color: '#152738' },
  small: { fontSize: 13, lineHeight: 19, color: '#415365' },
  error: { color: '#a02b2b', fontSize: 15, lineHeight: 22 },
});
