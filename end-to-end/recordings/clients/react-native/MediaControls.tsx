import { useEffect, useSyncExternalStore } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
import type { MediaController } from './media-controller';
import { Action } from './Action';

export function MediaControls({ controller, selected }: { controller: MediaController; selected: string | null }) {
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', value => { if (value !== 'active') controller.pause(); });
    return () => { subscription.remove(); controller.select(null); };
  }, [controller]);
  if (selected) return <View style={styles.controls}>
    <Text>Listen to verified audio imported through this app. Device and encrypted recordings are unavailable.</Text>
    <Action title={state.ready ? 'Reload audio' : 'Load audio'} onPress={() => void controller.load()} disabled={state.loading} secondary />
    {state.loading && <ActivityIndicator accessibilityLabel="Loading audio" />}
    {state.ready && <><Action title="Play audio" onPress={() => void controller.play()} /><Action title="Pause audio" onPress={() => controller.pause()} secondary /></>}
    {!!state.error && <Text accessibilityRole="alert">{state.error}</Text>}
  </View>;
  return <View style={styles.controls}>
    <Text>Import WAV, MP3, M4A, OGG, Opus, WebM or FLAC, up to 25 MiB. Processing starts separately.</Text>
    <Action title="Choose and upload audio" onPress={() => void controller.importAudio()} disabled={state.importing || state.importLocked} />
    {state.importing && <ActivityIndicator accessibilityLabel="Importing audio" />}
    {!!state.operation && <><Text>Upload {state.operation.state.replaceAll('_', ' ')}. Refresh the library to read its recording.</Text>
      <Action title="Refresh upload request" onPress={() => void controller.refreshUpload()} disabled={state.importing} secondary /></>}
    {state.canImportAnother && <Action title="Import another file" onPress={() => controller.anotherImport()} disabled={state.importing} secondary />}
    {state.importLocked && <Text>This upload will not be sent again from this session. Refresh its known request; if no ID was received, inspect the backend journal.</Text>}
    {!!state.importError && <Text accessibilityRole="alert">{state.importError}</Text>}
  </View>;
}

const styles = StyleSheet.create({ controls: { gap: 12 } });
