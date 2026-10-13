// Shared error identity keeps both HTTP adapters' existing instanceof checks valid.
export class RequestError extends Error {
  constructor(status, code, message = code.replaceAll('_', ' ')) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export class AppError extends RequestError {
  constructor(status, code, message) {
    super(status, code, message);
  }
}
export const ensure = (condition, status, code, message) => {
  if (!condition) throw new AppError(status, code, message);
};
export const object = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
export const isId = (value, prefix) =>
  typeof value === 'string' && new RegExp(`^${prefix}_[A-Za-z0-9_-]{1,128}$`).test(value);
export function assertProject(row, ctx) {
  ensure(
    object(row) &&
      (!Object.hasOwn(row, 'project_id') || row.project_id === ctx.principal.projectId) &&
      (!Object.hasOwn(row, 'deleted_at') || row.deleted_at === null),
    404,
    'NOT_FOUND',
    'Resource unavailable.',
  );
}
export const operationView = (op) => ({
  id: op.id,
  kind: op.kind,
  state: op.state,
  resource_id: op.resourceId,
  updated_at: op.updatedAt,
});

// Errors may expose only this caller's narrow action metadata, never journal details or content.
export function errorOperation(error) {
  const op =
    error instanceof AppError && ![401, 403, 404].includes(error.status) ? error.operation : null;
  const prefixes = { transcription: 'txn', summary: 'sum', ask: 'as' };
  if (
    !object(op) ||
    typeof op.id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(op.id) ||
    !Object.hasOwn(prefixes, op.kind) ||
    ![
      'claimed',
      'starting',
      'creating',
      'created',
      'sending',
      'submitted',
      'complete',
      'uncertain',
    ].includes(op.state) ||
    !(op.resource_id === null || isId(op.resource_id, prefixes[op.kind])) ||
    typeof op.updated_at !== 'string' ||
    op.updated_at.length > 64 ||
    !Number.isFinite(Date.parse(op.updated_at))
  )
    return null;
  return {
    id: op.id,
    kind: op.kind,
    state: op.state,
    resource_id: op.resource_id,
    updated_at: op.updated_at,
  };
}
