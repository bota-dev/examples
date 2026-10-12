export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
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
