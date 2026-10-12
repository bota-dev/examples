import { createHash } from 'node:crypto';

// Synthetic in-process upstream. It never delegates to global fetch or any network.
export function demoFetch({ onEvent = () => {} } = {}) {
  const at = '2026-10-12T10:00:00.000Z';
  const recordings = new Map();
  const transcriptions = new Map();
  const summaries = new Map();
  const sessions = new Map();
  const messages = new Map();
  let sequence = 10;
  const next = (prefix) => `${prefix}_demo${++sequence}`;
  const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const text =
    'This is synthetic example content. The team agreed to share the prototype on Friday and review customer feedback next week.';
  const notes = {
    overview: 'Synthetic notes from a product conversation.',
    key_points: [
      'The prototype is ready for review.',
      'Customer feedback will guide the next iteration.',
    ],
    action_items: ['Share the prototype on Friday.'],
    participants: ['Example participant'],
    decisions: ['Review feedback next week.'],
  };
  const page = (rows) => ({ data: rows.slice(0, 20), has_more: false, next_cursor: null });
  const response = (value, status = 200) =>
    new Response(JSON.stringify(value), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  const notification = (kind, row) =>
    onEvent({
      id: next('evt'),
      type: `${kind}.${kind === 'recording' ? 'uploaded' : 'completed'}`,
      createdAt: at,
      resourceKind: kind,
      resourceId: row.id,
      bodyHash: digest(JSON.stringify(row)),
    });
  const makeTranscript = (recordingId) => ({
    id: next('txn'),
    recording_id: recordingId,
    project_id: 'proj_demo',
    status: 'completed',
    created_at: at,
    full_text: text,
    segments: [{ start: 0, end: 12, text, speaker: 'Example speaker' }],
  });
  for (const [id, name] of [
    ['rec_demo001', 'Product discovery · Friday'],
    ['rec_demo002', 'Customer feedback · Next steps'],
  ]) {
    recordings.set(id, {
      id,
      name,
      end_user_id: 'eu_demo',
      project_id: 'proj_demo',
      source: 'api_upload',
      status: 'uploaded',
      created_at: at,
      duration_seconds: 42,
      content_sha256: digest(id),
      content_sha256_verified_at: at,
    });
  }
  const first = makeTranscript('rec_demo001');
  transcriptions.set(first.id, first);
  const firstSummary = {
    id: next('sum'),
    transcription_id: first.id,
    project_id: 'proj_demo',
    template_id: 'tmpl_general_notes',
    status: 'completed',
    created_at: at,
    output: notes,
  };
  summaries.set(firstSummary.id, firstSummary);
  notification('recording', recordings.get('rec_demo001'));
  return async (raw, options = {}) => {
    const url = new URL(raw);
    const method = options.method ?? 'GET';
    if (url.hostname === 'storage.example.test' && method === 'PUT') {
      const row = recordings.get(url.pathname.slice(1));
      if (!row || options.headers?.Authorization || options.headers?.Cookie)
        return response({}, 403);
      row.storedHash = digest(options.body);
      return new Response(null, { status: 200 });
    }
    if (url.hostname !== 'fixture.bota.invalid')
      throw new Error('Demo does not permit external networking.');
    const path = url.pathname.replace(/^\/v1/, '');
    const body = options.body ? JSON.parse(options.body) : {};
    if (path === '/recordings' && method === 'GET')
      return response(
        page(
          [...recordings.values()].filter(
            (row) => row.end_user_id === url.searchParams.get('end_user_id'),
          ),
        ),
      );
    if (path === '/recordings' && method === 'POST') {
      const row = {
        id: next('rec'),
        name: body.name,
        end_user_id: body.end_user_id,
        project_id: 'proj_demo',
        source: 'api_upload',
        status: 'pending',
        created_at: at,
        duration_seconds: null,
      };
      recordings.set(row.id, row);
      return response(row, 201);
    }
    const recordingMatch =
      /^\/recordings\/(rec_[A-Za-z0-9]+)(?:\/(upload-url|upload-complete))?$/.exec(path);
    if (recordingMatch) {
      const row = recordings.get(recordingMatch[1]);
      if (!row) return response({}, 404);
      if (method === 'GET' && !recordingMatch[2]) return response(row);
      if (method === 'POST' && recordingMatch[2] === 'upload-url')
        return response({
          upload_url: `https://storage.example.test/${row.id}`,
          content_type: body.content_type,
        });
      if (method === 'POST' && recordingMatch[2] === 'upload-complete') {
        if (row.storedHash !== body.content_sha256) return response({}, 409);
        row.content_sha256 = body.content_sha256;
        row.content_sha256_verified_at = at;
        row.status = 'uploaded';
        notification('recording', row);
        return response(row);
      }
    }
    if (path === '/transcriptions' && method === 'GET')
      return response(
        page(
          [...transcriptions.values()].filter(
            (row) => row.recording_id === url.searchParams.get('recording_id'),
          ),
        ),
      );
    if (path === '/transcriptions' && method === 'POST') {
      const row = makeTranscript(body.recording_id);
      transcriptions.set(row.id, row);
      notification('transcription', row);
      return response(row, 201);
    }
    if (path.startsWith('/transcriptions/') && method === 'GET')
      return response(
        transcriptions.get(path.split('/')[2]) ?? {},
        transcriptions.has(path.split('/')[2]) ? 200 : 404,
      );
    if (path === '/summaries' && method === 'GET')
      return response(
        page(
          [...summaries.values()].filter(
            (row) => row.transcription_id === url.searchParams.get('transcription_id'),
          ),
        ),
      );
    if (path === '/summaries' && method === 'POST') {
      const row = {
        id: next('sum'),
        transcription_id: body.transcription_id,
        project_id: 'proj_demo',
        template_id: body.template_id,
        status: 'completed',
        created_at: at,
        output: notes,
      };
      summaries.set(row.id, row);
      notification('summary', row);
      return response(row, 201);
    }
    if (path.startsWith('/summaries/') && method === 'GET')
      return response(
        summaries.get(path.split('/')[2]) ?? {},
        summaries.has(path.split('/')[2]) ? 200 : 404,
      );
    if (path === '/ask/sessions' && method === 'GET')
      return response(
        page(
          [...sessions.values()].filter(
            (row) =>
              row.end_user_id === url.searchParams.get('end_user_id') &&
              row.scope.recording_ids[0] === url.searchParams.get('recording_id'),
          ),
        ),
      );
    if (path === '/ask/sessions' && method === 'POST') {
      const row = {
        id: next('as'),
        end_user_id: body.end_user_id,
        scope: { type: 'recording', recording_ids: [body.scope.recording_id] },
        message_count: 0,
        created_at: at,
      };
      sessions.set(row.id, row);
      messages.set(row.id, []);
      return response(row, 201);
    }
    const sessionMatch = /^\/ask\/sessions\/(as_[A-Za-z0-9]+)(\/messages)?$/.exec(path);
    if (sessionMatch) {
      const row = sessions.get(sessionMatch[1]);
      if (!row) return response({}, 404);
      if (!sessionMatch[2] && method === 'GET') return response(row);
      if (sessionMatch[2] && method === 'GET') return response(page(messages.get(row.id)));
      if (sessionMatch[2] && method === 'POST') {
        const answer = {
          id: next('msg'),
          role: 'assistant',
          content:
            'Synthetic answer: share the prototype on Friday, then review customer feedback.',
          finish_reason: 'stop',
          parts: [
            { type: 'text', text: 'Synthetic answer.' },
            { type: 'citation', recording_id: row.scope.recording_ids[0], start_ms: 0 },
          ],
        };
        messages.get(row.id).push({ id: next('msg'), role: 'user', content: body.content }, answer);
        row.message_count = messages.get(row.id).length;
        return response({ session_id: row.id, message: answer, sources: [] });
      }
    }
    return response({}, 404);
  };
}
