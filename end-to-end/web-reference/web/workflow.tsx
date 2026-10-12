import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ApiClient, MutationResult, Operation } from './api';
import { ApiError, errorMessage, operationMetadata } from './api';

export function useRead<T>(api: ApiClient, path: string | null) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    path: string | null;
    data: T | null;
    loading: boolean;
    error: string;
  }>({
    path: null,
    data: null,
    loading: false,
    error: '',
  });
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    let current = true;
    setState((previous) => ({
      path,
      data: previous.path === path ? previous.data : null,
      loading: true,
      error: '',
    }));
    void api
      .get<T>(path, controller.signal)
      .then((data) => {
        if (current) setState({ path, data, loading: false, error: '' });
      })
      .catch((error) => {
        if (current && !controller.signal.aborted)
          setState({ path, data: null, loading: false, error: errorMessage(error) });
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [api, path, revision]);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  return {
    ...state,
    data: state.path === path ? state.data : null,
    loading: path !== null && (state.path !== path || state.loading),
    refresh,
  };
}

export interface IntentScope {
  locks: Set<string>;
  requests: Map<string, Operation>;
  record: (operation: Operation) => void;
}
export const IntentContext = createContext<IntentScope | null>(null);

export function useIntent<T extends MutationResult>(
  key: string,
  api: ApiClient,
  validate?: (result: T) => T,
) {
  const scope = useContext(IntentContext);
  if (!scope) throw new Error('Action requires a signed-in workbench.');
  const [state, setState] = useState<{
    key: string;
    busy: boolean;
    refreshing: boolean;
    result: T | null;
    error: string;
  }>({ key, busy: false, refreshing: false, result: null, error: '' });
  const mounted = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const currentResult = state.key === key ? state.result : null;
  const knownOperation = scope.requests.get(key);
  const result = currentResult ?? (knownOperation ? ({ operation: knownOperation } as T) : null);
  const record = (operation: Operation) => {
    scope.requests.set(key, operation);
    scope.record(operation);
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  const mutate = async (action: (signal: AbortSignal) => Promise<T>) => {
    if (scope.locks.has(key) || controller.current) return;
    scope.locks.add(key);
    const attempt = new AbortController();
    controller.current = attempt;
    setState({ key, busy: true, refreshing: false, result: null, error: '' });
    let receivedOperation: Operation | undefined;
    try {
      const response = await action(attempt.signal);
      receivedOperation = operationMetadata(response.operation);
      if (!receivedOperation)
        throw new ApiError(502, 'invalid_operation', 'The request metadata could not be verified.');
      const result = validate
        ? validate({ ...response, operation: receivedOperation })
        : { ...response, operation: receivedOperation };
      if (mounted.current && !attempt.signal.aborted) {
        record(result.operation);
        setState({ key, busy: false, refreshing: false, result, error: '' });
      }
    } catch (error) {
      if (mounted.current && !attempt.signal.aborted) {
        const known =
          error instanceof ApiError ? (error.operation ?? receivedOperation) : receivedOperation;
        const preclaimReadinessRejection =
          error instanceof ApiError &&
          error.status === 409 &&
          !error.operationPresent &&
          !known &&
          !scope.requests.has(key) &&
          ((key.startsWith('transcription:') && error.code === 'upload_unverified') ||
            (key.startsWith('summary:') && error.code === 'transcription_incomplete'));
        if (preclaimReadinessRejection) scope.locks.delete(key);
        if (known) record(known);
        setState({
          key,
          busy: false,
          refreshing: false,
          result: known ? ({ operation: known } as T) : null,
          error: errorMessage(error),
        });
      }
    } finally {
      if (controller.current === attempt) controller.current = null;
    }
  };
  const refreshRequest = async () => {
    const previous = result?.operation;
    if (!previous || controller.current) return;
    const attempt = new AbortController();
    controller.current = attempt;
    setState({
      key,
      busy: false,
      refreshing: true,
      result: { operation: previous } as T,
      error: '',
    });
    try {
      const response = await api.get<T>(
        `/api/operations/${encodeURIComponent(previous.id)}`,
        attempt.signal,
      );
      const operation = operationMetadata(response.operation);
      if (!operation || operation.id !== previous.id || operation.kind !== previous.kind) {
        throw new ApiError(
          502,
          'invalid_operation',
          'The refreshed request did not match the recorded request.',
        );
      }
      const result = validate ? validate({ ...response, operation }) : { ...response, operation };
      if (mounted.current && !attempt.signal.aborted) {
        record(operation);
        setState({ key, busy: false, refreshing: false, result, error: '' });
      }
    } catch (error) {
      if (mounted.current && !attempt.signal.aborted) {
        const latest = error instanceof ApiError ? error.operation : undefined;
        const operation =
          latest?.id === previous.id && latest.kind === previous.kind ? latest : previous;
        record(operation);
        setState({
          key,
          busy: false,
          refreshing: false,
          result: { operation } as T,
          error: errorMessage(error),
        });
      }
    } finally {
      if (controller.current === attempt) controller.current = null;
    }
  };
  return {
    busy: state.busy,
    refreshing: state.refreshing,
    result,
    error: state.key === key ? state.error : '',
    locked: scope.locks.has(key),
    mutate,
    refreshRequest,
  };
}

export function IntentNotice({
  busy,
  locked,
  error,
  operation,
  refreshing,
  onRefresh,
}: {
  busy: boolean;
  locked: boolean;
  error: string;
  operation?: Operation;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  if (!locked)
    return error ? (
      <div className="intent-note" role="alert">
        <strong>Action not started</strong>
        <p>{error}</p>
        <small>Refresh the source readiness, then choose this action when it is ready.</small>
      </div>
    ) : null;
  const needsReview =
    Boolean(error) || !operation || !['complete', 'submitted'].includes(operation.state);
  return (
    <div className={`intent-note ${needsReview && !busy ? 'review-note' : ''}`} role="status">
      <strong>
        {refreshing
          ? 'Refreshing this request'
          : busy
            ? 'Request in progress'
            : needsReview
              ? 'Review this request'
              : operation!.state === 'complete'
                ? 'Request completed'
                : 'Request accepted'}
      </strong>
      <p>
        {refreshing
          ? 'Reading the saved request and its current result.'
          : busy
            ? 'Keep this page open while the server records the result.'
            : error ||
              (needsReview
                ? 'Its outcome needs review. Refresh activity and read the current resource state before taking another action.'
                : 'Refresh the current results when you are ready.')}
      </p>
      {operation && onRefresh ? (
        <button
          className="secondary-button request-refresh"
          disabled={busy || refreshing}
          onClick={onRefresh}
        >
          {refreshing ? 'Refreshing request…' : 'Refresh request'} <span aria-hidden="true">↻</span>
        </button>
      ) : null}
      {!busy ? <small>This attempt will not be sent again from this session.</small> : null}
    </div>
  );
}
