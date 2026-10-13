// Compatibility path; AppError remains a RequestError for the native HTTP adapter.
export {
  AppError,
  ensure,
  object,
  isId,
  assertProject,
  operationView,
  errorOperation,
} from '../../../recordings/backend/errors.mjs';
