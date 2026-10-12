import { useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { RecordingsController, RecordingState } from './recordings-controller';

export function Action({ title, onPress, disabled = false, secondary = false }: {
  title: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, disabled && styles.disabled, pressed && !disabled && styles.pressed]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{title}</Text>
  </Pressable>;
}

const duration = (seconds: number | null) => seconds === null ? 'Duration unavailable' : `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const date = (iso: string) => new Date(iso).toLocaleDateString();

export function LibraryView({ controller, mode, onExit, onDevice }: {
  controller: RecordingsController; mode: 'sample' | 'live'; onExit: () => void; onDevice: () => void;
}) {
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot);
  const [requestsOpen, setRequestsOpen] = useState(false);
  useEffect(() => { void controller.refreshLibrary(); void controller.refreshOperations(); }, [controller]);

  return <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
    <View style={styles.row}>
      <Text accessibilityRole="header" style={styles.title}>Recordings</Text>
      <Action title={mode === 'sample' ? 'Exit sample' : 'Sign out'} onPress={onExit} secondary />
    </View>
    {mode === 'sample' ? <View style={styles.sample}><Text style={styles.sampleText}>Sample mode · synthetic content</Text>
      <Text>Actions simulate results locally. No hardware, upload, provider or API request runs.</Text></View> :
      <View style={styles.row}><Text style={styles.muted}>Connected to your backend</Text><Action title="Device" onPress={onDevice} secondary /></View>}

    {state.selected ? <>
      <Action title="Back to library" onPress={() => controller.back()} secondary />
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.heading}>{state.selected.name ?? 'Untitled recording'}</Text>
        <Text style={styles.muted}>{date(state.selected.created_at)} · {duration(state.selected.duration_seconds)}</Text>
        <View style={styles.tabs}>
          {(['Transcript', 'Summary', 'Ask'] as const).map(tab => <Pressable key={tab} accessibilityRole="tab" accessibilityLabel={tab}
            accessibilityState={{ selected: state.tab === tab }} onPress={() => controller.setTab(tab)} style={[styles.tab, state.tab === tab && styles.activeTab]}>
            <Text style={[styles.tabText, state.tab === tab && styles.activeTabText]}>{tab}</Text>
          </Pressable>)}
        </View>
        <Action title="Refresh results" onPress={() => void controller.refreshDetail()} disabled={state.detailLoading} secondary />
        {state.detailLoading && <ActivityIndicator accessibilityLabel="Reading current results" />}
        {!!state.detailError && <Text accessibilityRole="alert" style={styles.error}>{state.detailError}</Text>}
        {!state.detailLoading && !state.detailError && <Detail state={state} controller={controller} />}
        <RequestNotice state={state} controller={controller} />
      </View>
    </> : <>
      <View style={styles.row}><Text style={styles.muted}>Your audio and notes</Text>
        <Action title="Refresh library" onPress={() => void controller.refreshLibrary()} disabled={state.listLoading} secondary /></View>
      {state.listLoading && <ActivityIndicator accessibilityLabel="Reading recordings" />}
      {!!state.listError && <Text accessibilityRole="alert" style={styles.error}>{state.listError}</Text>}
      {!state.listLoading && !state.listError && !state.recordings.length && <View style={styles.card}><Text>No recordings yet.</Text>
        <Text style={styles.muted}>Add audio through your Bota integration, then refresh the library.{mode === 'live' ? ' Use Device for the supported Android sync example.' : ''}</Text></View>}
      {state.recordings.map(row => <Pressable key={row.id} accessibilityRole="button" accessibilityLabel={`Open ${row.name ?? 'Untitled recording'}`}
        onPress={() => controller.select(row)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <Text style={styles.heading}>{row.name ?? 'Untitled recording'}</Text>
        <Text style={styles.muted}>{date(row.created_at)} · {duration(row.duration_seconds)}</Text>
        <Text style={styles.muted}>{row.status.replaceAll('_', ' ')}{row.upload_verified ? ' · upload verified' : ''}</Text>
      </Pressable>)}
      {!!state.nextCursor && <Action title="Load more recordings" onPress={() => void controller.refreshLibrary(true)} disabled={state.listLoading} secondary />}
    </>}

    <Action title={requestsOpen ? 'Hide request status' : 'Request status'} onPress={() => setRequestsOpen(value => !value)} secondary />
    {requestsOpen && <View style={styles.card}>
      <Text style={styles.muted}>Saved request metadata helps recover interrupted work. Refresh reads its current state; it never sends the original action again.</Text>
      <Action title="Refresh saved requests" onPress={() => void controller.refreshOperations()} disabled={state.operationsLoading} secondary />
      {!!state.operationsError && <Text accessibilityRole="alert" style={styles.error}>{state.operationsError}</Text>}
      {!state.operations.length && !state.operationsLoading && <Text>No saved requests.</Text>}
      {state.operations.map(row => <View key={row.id} style={styles.requestRow}>
        <Text>{row.kind} · {row.state.replaceAll('_', ' ')}</Text>
        <Action title="Refresh request" onPress={() => void controller.refreshOperations(row.id)} disabled={state.operationsLoading} secondary />
      </View>)}
    </View>}
  </ScrollView>;
}

function Detail({ state, controller }: { state: RecordingState; controller: RecordingsController }) {
  const locked = controller.isLocked(), busy = !!state.request?.busy;
  if (state.tab === 'Transcript') return <View style={styles.result}>
    {state.transcripts.map(row => <View key={row.id} style={styles.result}>
      <Text style={styles.label}>{row.status.replaceAll('_', ' ')}</Text>
      {row.status === 'completed' ? <Text selectable style={styles.body}>{row.full_text}</Text> : <Text>Refresh to read the current transcription state.</Text>}
    </View>)}
    {!state.transcripts.length && <Text>No transcript yet. Turn this recording into text.</Text>}
    <Action title="Start transcription" onPress={() => void controller.startTranscription()} disabled={!state.selected?.upload_verified || !!state.transcripts.length || locked || busy} />
    {!state.selected?.upload_verified && <Text style={styles.muted}>Wait for upload verification before starting transcription.</Text>}
  </View>;
  if (!state.sourceId) return <Text style={styles.body}>Complete a transcript first, then refresh results to use {state.tab === 'Summary' ? 'Summary' : 'Ask'}.</Text>;
  if (state.tab === 'Summary') return <View style={styles.result}>
    {state.transcripts.filter(row => row.status === 'completed').length > 1 && <View style={styles.result}>
      <Text style={styles.label}>Source transcript</Text>
      {state.transcripts.filter(row => row.status === 'completed').map((row, index) => <Action key={row.id}
        title={`Transcript ${index + 1}${state.sourceId === row.id ? ' · selected' : ''}`} onPress={() => void controller.chooseSource(row.id)} secondary />)}
    </View>}
    {state.summaries.map(row => <View key={row.id} style={styles.result}>
      <Text style={styles.label}>{row.status.replaceAll('_', ' ')}</Text>
      {row.status === 'completed' && row.output ? <>
        <Text selectable style={styles.body}>{row.output.overview}</Text>
        {([['key_points', 'Key points'], ['action_items', 'Next steps'], ['decisions', 'Decisions'], ['participants', 'Participants']] as const).map(([field, label]) =>
          row.output?.[field].length ? <View key={field} style={styles.result}><Text style={styles.label}>{label}</Text>
            {row.output[field].map((item, index) => <Text selectable key={index} style={styles.body}>• {item}</Text>)}</View> : null)}
      </> : <Text>Refresh to read the current summary state.</Text>}
    </View>)}
    {!state.summaries.length && <Text>No summary yet. Create general notes from the completed transcript.</Text>}
    <Action title="Create summary" onPress={() => void controller.startSummary()} disabled={!!state.summaries.length || locked || busy} />
    <Text style={styles.muted}>Review generated notes with the transcript.</Text>
  </View>;
  return <View style={styles.result}>
    <Text style={styles.label}>Your question</Text>
    <TextInput accessibilityLabel="Question about this recording" value={state.question} onChangeText={question => controller.setQuestion(question)}
      multiline maxLength={10_000} editable={!busy} placeholder="What are the next steps?" style={styles.question} textAlignVertical="top" />
    <Action title="Ask recording" onPress={() => void controller.ask()} disabled={!state.question.trim() || locked || busy} />
    {!!state.answer && <><Text style={styles.label}>Answer</Text><Text selectable style={styles.body}>{state.answer}</Text>
      {state.citations.map((citation, index) => <Text key={index} style={styles.muted}>This recording · {duration(citation.start_ms / 1000)}</Text>)}</>}
    <Text style={styles.muted}>Answers use this recording's transcript. Review them with the source.</Text>
  </View>;
}

function RequestNotice({ state, controller }: { state: RecordingState; controller: RecordingsController }) {
  const request = state.request;
  if (!request) return null;
  const locked = controller.isLocked();
  return <View accessibilityLiveRegion="polite" style={styles.notice}>
    <Text style={styles.label}>{request.busy ? 'Requesting…' : request.operation?.state === 'complete' ? 'Request completed' : locked ? 'Request retained' : 'Action not started'}</Text>
    <Text>{request.error || (locked ? 'Refresh results to read the current resource.' : 'Refresh source readiness before trying this action.')}</Text>
    {!!request.operation && <Action title="Refresh this request" onPress={() => void controller.refreshRequest()} disabled={request.busy} secondary />}
    {locked && !request.busy && <Text style={styles.muted}>This action will not be sent again from this session. If its ID is unknown, inspect the backend journal.</Text>}
  </View>;
}

const styles = StyleSheet.create({
  screen: { padding: 20, paddingTop: 54, gap: 16, backgroundColor: '#f4f6f8', flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  title: { fontSize: 26, fontWeight: '700', color: '#152738' },
  heading: { fontSize: 19, fontWeight: '600', color: '#152738' },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d7dfe7', borderRadius: 10, padding: 18, gap: 12 },
  label: { fontWeight: '600', color: '#152738', fontSize: 15 },
  body: { fontSize: 16, lineHeight: 25, color: '#152738' },
  muted: { fontSize: 13, lineHeight: 20, color: '#415365' },
  button: { backgroundColor: '#14659b', minHeight: 46, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  secondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#8494a4' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  secondaryText: { color: '#164d73' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
  sample: { backgroundColor: '#e9f2fa', borderWidth: 1, borderColor: '#bfd7ec', padding: 14, borderRadius: 8, gap: 6 },
  sampleText: { fontWeight: '600', color: '#164d73' },
  tabs: { flexDirection: 'row', gap: 4, backgroundColor: '#edf1f5', borderRadius: 6, padding: 4 },
  tab: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
  activeTab: { backgroundColor: '#14659b' },
  tabText: { color: '#415365', fontWeight: '600' },
  activeTabText: { color: '#fff' },
  result: { gap: 12 },
  question: { minHeight: 100, borderWidth: 1, borderColor: '#8494a4', borderRadius: 6, padding: 12, color: '#152738', fontSize: 16 },
  notice: { backgroundColor: '#f0f4f7', borderRadius: 6, padding: 14, gap: 10 },
  requestRow: { borderTopWidth: 1, borderColor: '#d7dfe7', paddingTop: 12, gap: 10 },
  error: { color: '#a02b2b', fontSize: 15, lineHeight: 22 },
});
