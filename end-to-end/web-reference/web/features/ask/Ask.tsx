import { useState } from 'react';
import type { ApiClient, AskResult, Collection, Transcription } from '../../api';
import { ApiError } from '../../api';
import { durationLabel } from '../../format';
import { IntentNotice, useIntent, useRead } from '../../workflow';
import { Capability } from '../../Capability';

export function Ask({ api, recordingId }: { api: ApiClient; recordingId: string }) {
  const [question, setQuestion] = useState('');
  const trimmed = question.trim();
  const transcripts = useRead<Collection<Transcription>>(
    api,
    `/api/recordings/${encodeURIComponent(recordingId)}/transcriptions`,
  );
  const ready = transcripts.data?.data.some((job) => job.status === 'completed');
  const intent = useIntent<AskResult>(`ask:${recordingId}:${trimmed}`, api, (result) => {
    if (
      result.citations?.some(
        (citation) =>
          citation.recording_id !== recordingId ||
          !Number.isSafeInteger(citation.start_ms) ||
          citation.start_ms < 0,
      )
    ) {
      throw new ApiError(
        502,
        'invalid_citations',
        'The returned citations did not match this recording. Review this request.',
      );
    }
    return result;
  });
  return (
    <section className="feature-panel" aria-labelledby="ask-heading">
      <p className="eyebrow">04 / Follow your curiosity</p>
      <h3 id="ask-heading">Ask this recording.</h3>
      <p className="muted">
        One question, grounded in this recording. Answers may contain mistakes; review the source.
      </p>
      <Capability
        calls={[
          'POST /v1/ask/sessions',
          'POST /v1/ask/sessions/:id/messages',
          'GET /v1/ask/sessions/:id/messages',
        ]}
        docs="https://docs.bota.dev/api-reference/ask/create-session"
        source="server/features/ask.mjs"
      />
      {transcripts.error ? (
        <p className="error-note" role="alert">
          {transcripts.error}
        </p>
      ) : null}
      {!ready ? (
        <div className="prerequisite-note">
          <p>
            {transcripts.loading
              ? 'Checking for a completed transcript…'
              : 'A completed transcript is required to ask a question.'}
          </p>
          <button
            className="text-button"
            onClick={transcripts.refresh}
            disabled={transcripts.loading}
          >
            Refresh source transcripts
          </button>
        </div>
      ) : null}
      <form
        className="ask-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!ready || !trimmed || trimmed.length > 10000) return;
          void intent.mutate((signal) =>
            api.post<AskResult>(
              `/api/recordings/${encodeURIComponent(recordingId)}/ask`,
              { question: trimmed },
              signal,
            ),
          );
        }}
      >
        <label htmlFor="recording-question">Your question</label>
        <textarea
          id="recording-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          disabled={intent.busy || intent.refreshing}
          maxLength={10000}
          rows={4}
          placeholder="What decisions did we make, and what happens next?"
          aria-describedby="question-guidance"
        />
        <div className="action-row">
          <button
            type="submit"
            className="primary-button"
            disabled={!ready || !trimmed || intent.busy || intent.locked}
          >
            {intent.busy ? 'Asking…' : 'Ask recording'} <span aria-hidden="true">↗</span>
          </button>
          <small id="question-guidance">Starts one answer request.</small>
        </div>
      </form>
      {typeof intent.result?.answer === 'string' ? (
        <article className="answer-result">
          <p className="eyebrow">Answer / Review with the source</p>
          <p className="answer-text">{intent.result.answer}</p>
          {intent.result.citations?.length ? (
            <ul className="citations" aria-label="Answer citations">
              {intent.result.citations.map((citation, index) => (
                <li key={index}>
                  <span aria-hidden="true">↗</span> This recording ·{' '}
                  {durationLabel(citation.start_ms / 1000)}
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      ) : null}
      <IntentNotice
        busy={intent.busy}
        locked={intent.locked}
        error={intent.error}
        operation={intent.result?.operation}
        refreshing={intent.refreshing}
        onRefresh={() => void intent.refreshRequest()}
      />
    </section>
  );
}
