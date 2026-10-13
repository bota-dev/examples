import 'package:flutter/material.dart';
import 'api.dart';
import 'models.dart';
import 'sample_api.dart';
import 'recordings_controller.dart';
import 'device_page.dart';

void main() => runApp(const RecordingsApp());

class RecordingsApp extends StatelessWidget {
  const RecordingsApp({super.key, this.controller});
  final RecordingsController? controller;
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Bota Recordings Sample',
    theme: ThemeData(colorSchemeSeed: const Color(0xff176e61)),
    home: RecordingsHome(controller: controller),
  );
}

class RecordingsHome extends StatefulWidget {
  const RecordingsHome({super.key, this.controller});
  final RecordingsController? controller;
  @override
  State<RecordingsHome> createState() => _RecordingsHomeState();
}

class _RecordingsHomeState extends State<RecordingsHome> {
  late final state = widget.controller ?? RecordingsController();
  final origin = TextEditingController(text: 'http://127.0.0.1:8787');
  final token = TextEditingController();
  String setupError = '';
  bool connecting = false;
  bool deviceOpen = false;
  bool deviceBlocked = false;
  String deviceError = '';
  Future<void> deviceCleanup = Future<void>.value();

  Future<void> openDevice() async {
    if (deviceOpen || deviceBlocked) return;
    deviceOpen = true;
    try {
      await deviceCleanup;
      if (!mounted || !state.signedIn || state.sample) return;
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => ListenableBuilder(
            listenable: state,
            builder: (_, _) => state.signedIn
                ? DevicePage(onCleanup: (future) => deviceCleanup = future)
                : const Scaffold(
                    body: Center(
                      child: Text('Session ended. Return to sign in.'),
                    ),
                  ),
          ),
        ),
      );
      await deviceCleanup;
    } catch (_) {
      if (mounted) {
        setState(() {
          deviceBlocked = true;
          deviceError =
              'Device cleanup did not complete. Restart the sample before connecting again.';
        });
      }
    } finally {
      deviceOpen = false;
    }
  }

  @override
  void dispose() {
    origin.dispose();
    token.dispose();
    if (widget.controller == null) state.dispose();
    super.dispose();
  }

  Future<void> connectLive() async {
    if (connecting) return;
    setState(() {
      connecting = true;
      setupError = '';
    });
    try {
      final api = BackendApi(origin.text, token.text.trim());
      await state.connect(api, isSample: false);
    } on FormatException {
      if (mounted) {
        setState(
          () => setupError =
              'Use your customer backend origin and its separate application token. HTTPS is required except on loopback.',
        );
      }
    } finally {
      if (state.signedIn) token.clear();
      if (mounted) setState(() => connecting = false);
    }
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: state,
    builder: (context, _) {
      if (!state.signedIn) return _setup();
      return Scaffold(
        appBar: AppBar(
          leading: state.selectedId == null
              ? null
              : IconButton(
                  tooltip: 'Back to recordings',
                  icon: const Icon(Icons.arrow_back),
                  onPressed: state.leaveDetail,
                ),
          title: const Text('Recordings'),
          actions: [
            Chip(label: Text(state.sample ? 'Sample' : 'Live')),
            PopupMenuButton<String>(
              tooltip: 'Sample settings',
              onSelected: (choice) {
                if (choice == 'device') {
                  openDevice();
                } else {
                  state.signOut();
                }
              },
              itemBuilder: (_) => [
                if (!state.sample)
                  PopupMenuItem(
                    value: 'device',
                    enabled: !deviceBlocked,
                    child: const Text('Device connection'),
                  ),
                const PopupMenuItem(value: 'out', child: Text('Sign out')),
              ],
            ),
          ],
        ),
        body: SafeArea(
          child: Column(
            children: [
              if (state.sample)
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  child: Text(
                    'Synthetic recordings · local sample only',
                    style: TextStyle(fontSize: 12),
                  ),
                ),
              if (state.error.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: Text(
                    state.error,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
              Expanded(
                child: state.selectedId == null ? _library() : _detail(),
              ),
              if (deviceError.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: Text(deviceError),
                ),
            ],
          ),
        ),
      );
    },
  );

  Widget _setup() => Scaffold(
    appBar: AppBar(title: const Text('Bota Recordings Sample')),
    body: ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const Text(
          'Your recordings, transcripts and notes.',
          style: TextStyle(fontSize: 24),
        ),
        const SizedBox(height: 12),
        const Text(
          'Try the common app flow with local sample recordings, or connect your customer backend.',
        ),
        const SizedBox(height: 20),
        FilledButton(
          onPressed: connecting
              ? null
              : () {
                  token.clear();
                  setupError = '';
                  state.connect(SampleApi(), isSample: true);
                },
          child: const Text('Try sample recordings'),
        ),
        const SizedBox(height: 32),
        const Text('Connect your backend', style: TextStyle(fontSize: 18)),
        TextField(
          controller: origin,
          enabled: !connecting,
          autocorrect: false,
          decoration: const InputDecoration(labelText: 'Backend origin'),
        ),
        TextField(
          controller: token,
          enabled: !connecting,
          obscureText: true,
          autocorrect: false,
          enableSuggestions: false,
          decoration: const InputDecoration(
            labelText: 'Application access token',
          ),
        ),
        const SizedBox(height: 12),
        OutlinedButton(
          onPressed: connecting ? null : connectLive,
          child: Text(connecting ? 'Connecting…' : 'Connect'),
        ),
        const Text(
          'Use the token from this sample’s customer backend. Credentials stay in memory.',
          style: TextStyle(fontSize: 12),
        ),
        if (setupError.isNotEmpty) Text(setupError),
        if (state.error.isNotEmpty) Text(state.error),
      ],
    ),
  );

  Widget _library() => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      Row(
        children: [
          const Expanded(
            child: Text('All recordings', style: TextStyle(fontSize: 20)),
          ),
          IconButton(
            tooltip: 'Refresh recordings',
            onPressed: state.loading ? null : state.refreshLibrary,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      if (state.loading) const LinearProgressIndicator(),
      if (state.recordings.isEmpty && !state.loading)
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 32),
          child: Text(
            'No recordings yet. Add audio through your configured upload workflow, then refresh.',
          ),
        ),
      for (final recording in state.recordings)
        Card(
          child: ListTile(
            leading: const Icon(Icons.graphic_eq),
            title: Text(
              recording.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            subtitle: Text(
              '${_date(recording.createdAt)} · ${_duration(recording.durationSeconds)}\n${recording.status}',
            ),
            isThreeLine: true,
            trailing: const Icon(Icons.chevron_right),
            onTap: () => state.select(recording.id),
          ),
        ),
      if (state.incomplete)
        const Text(
          'Showing the first page. More recordings are available in your backend.',
        ),
      const SizedBox(height: 20),
      ExpansionTile(
        title: const Text('Recent requests'),
        onExpansionChanged: (expanded) {
          if (expanded) state.refreshOperations();
        },
        children: [
          const Padding(
            padding: EdgeInsets.all(12),
            child: Text(
              'Refresh saved request status after a connection problem. This never repeats a processing action.',
              style: TextStyle(fontSize: 12),
            ),
          ),
          if (state.operations.isEmpty)
            const ListTile(title: Text('No saved requests.')),
          for (final operation in state.operations)
            ListTile(
              title: Text('${operation.kind} · ${operation.state}'),
              trailing: IconButton(
                tooltip: 'Refresh request ${operation.id}',
                icon: const Icon(Icons.refresh),
                onPressed: () => state.refreshOperation(operation),
              ),
            ),
        ],
      ),
    ],
  );

  Widget _detail() {
    final recording = state.selected;
    if (state.detailLoading && recording == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (recording == null) {
      return Center(
        child: OutlinedButton(
          onPressed: state.refreshDetail,
          child: const Text('Refresh recording'),
        ),
      );
    }
    return DefaultTabController(
      length: 3,
      child: Column(
        children: [
          ListTile(
            title: Text(
              recording.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            subtitle: Text(
              '${_date(recording.createdAt)} · ${_duration(recording.durationSeconds)}',
            ),
            trailing: IconButton(
              tooltip: 'Refresh recording',
              onPressed: state.detailLoading ? null : state.refreshDetail,
              icon: const Icon(Icons.refresh),
            ),
          ),
          if (state.detailLoading) const LinearProgressIndicator(),
          TabBar(
            onTap: (tab) {
              if (tab == 1) state.refreshSummaries();
            },
            tabs: const [
              Tab(text: 'Transcript'),
              Tab(text: 'Summary'),
              Tab(text: 'Ask'),
            ],
          ),
          Expanded(
            child: TabBarView(
              physics: const NeverScrollableScrollPhysics(),
              children: [
                _transcript(recording),
                _summary(),
                AskTab(key: ValueKey(recording.id), state: state),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _transcript(Recording recording) {
    final row = state.transcript;
    final key = 'transcription:${recording.id}';
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        if (row == null)
          const Text('Create a transcript to read what was said.')
        else ...[
          Text('Status: ${row.status}'),
          const SizedBox(height: 16),
          if (row.status == 'completed')
            SelectableText(row.fullText ?? 'No transcript text returned.')
          else
            const Text(
              'Processing is still running. Refresh to check its status.',
            ),
        ],
        const SizedBox(height: 20),
        if (row == null)
          FilledButton(
            onPressed: recording.uploadVerified && !state.locked(key)
                ? state.transcribe
                : null,
            child: Text(state.busy(key) ? 'Starting…' : 'Create transcript'),
          ),
        if (!recording.uploadVerified)
          const Text('Wait for the backend to verify the upload.'),
        _notice(key),
      ],
    );
  }

  Widget _summary() {
    final transcript = state.transcript;
    final key = transcript == null ? '' : 'summary:${transcript.id}';
    final note = state.summaries.isEmpty ? null : state.summaries.first;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        if (state.summaryLoading) const LinearProgressIndicator(),
        if (note == null)
          const Text(
            'Create a short overview and action items from the transcript.',
          )
        else ...[
          Text('Status: ${note.status}'),
          const SizedBox(height: 16),
          if (note.status == 'completed') ...[
            if (note.overview != null) SelectableText(note.overview!),
            for (final section in {
              'key_points': 'Key points',
              'action_items': 'Action items',
              'participants': 'Participants',
              'decisions': 'Decisions',
            }.entries)
              if (note.lines(section.key).isNotEmpty) ...[
                const SizedBox(height: 16),
                Text(
                  section.value,
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                for (final line in note.lines(section.key))
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: SelectableText('• $line'),
                  ),
              ],
          ] else
            const Text(
              'Processing is still running. Refresh to check its status.',
            ),
        ],
        const SizedBox(height: 20),
        OutlinedButton(
          onPressed: state.summaryLoading ? null : state.refreshSummaries,
          child: const Text('Refresh summary'),
        ),
        if (note == null)
          FilledButton(
            onPressed: transcript?.status == 'completed' && !state.locked(key)
                ? state.summarize
                : null,
            child: Text(state.busy(key) ? 'Starting…' : 'Create summary'),
          ),
        if (transcript?.status != 'completed')
          const Text('Complete the transcript first.'),
        _notice(key),
      ],
    );
  }

  Widget _notice(String key) {
    final intent = state.intents[key];
    if (intent == null || !intent.needsNotice) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            intent.busy
                ? 'Requesting…'
                : intent.operation == null
                ? 'The outcome may be unknown. Check Recent requests before starting another action.'
                : 'Request: ${intent.operation!.state}',
            style: const TextStyle(fontSize: 12),
          ),
          if (intent.error.isNotEmpty) Text(intent.error),
          if (intent.operation != null && !intent.busy)
            TextButton(
              onPressed: () => state.refreshOperation(intent.operation!),
              child: const Text('Refresh request'),
            ),
        ],
      ),
    );
  }
}

class AskTab extends StatefulWidget {
  const AskTab({super.key, required this.state});
  final RecordingsController state;
  @override
  State<AskTab> createState() => _AskTabState();
}

class _AskTabState extends State<AskTab> {
  final question = TextEditingController();
  @override
  void dispose() {
    question.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.state;
    final key = 'ask:${state.selectedId}:${question.text.trim()}';
    final intent = state.intents[key];
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text('Ask a question about this recording.'),
        const SizedBox(height: 12),
        TextField(
          controller: question,
          minLines: 2,
          maxLines: 4,
          maxLength: 10000,
          onChanged: (_) {
            state.setQuestion(question.text);
            setState(() {});
          },
          decoration: const InputDecoration(
            labelText: 'Your question',
            hintText: 'What are the next steps?',
          ),
        ),
        FilledButton(
          onPressed:
              state.transcript?.status == 'completed' &&
                  question.text.trim().isNotEmpty &&
                  !state.locked(key)
              ? () => state.ask(question.text)
              : null,
          child: Text(state.busy(key) ? 'Asking…' : 'Ask'),
        ),
        if (state.transcript?.status != 'completed')
          const Text('Complete the transcript first.'),
        if (state.answer?.answer != null) ...[
          const SizedBox(height: 20),
          SelectableText(state.answer!.answer!),
          const SizedBox(height: 12),
          for (final citation in state.answer!.citations)
            Text(
              'Source: ${_duration(citation.inSeconds.toDouble())} in this recording',
              style: const TextStyle(fontSize: 12),
            ),
        ],
        if (intent != null && intent.needsNotice) ...[
          const SizedBox(height: 16),
          Text(
            intent.busy
                ? 'Requesting…'
                : intent.operation == null
                ? 'The outcome may be unknown. Check Recent requests; this question will not be sent again.'
                : 'Request: ${intent.operation!.state}',
            style: const TextStyle(fontSize: 12),
          ),
          if (intent.error.isNotEmpty) Text(intent.error),
          if (intent.operation != null && !intent.busy)
            TextButton(
              onPressed: () => state.refreshOperation(intent.operation!),
              child: const Text('Refresh request'),
            ),
        ],
      ],
    );
  }
}

String _date(DateTime value) {
  final date = value.toLocal();
  return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
}

String _duration(double? value) {
  if (value == null || !value.isFinite || value < 0) {
    return 'Duration unavailable';
  }
  final seconds = value.round();
  return '${seconds ~/ 60}:${(seconds % 60).toString().padLeft(2, '0')}';
}
