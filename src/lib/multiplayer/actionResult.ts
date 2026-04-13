import type { ZodError } from "zod";

/** Supported error codes for multiplayer Server Actions. */
export type AppErrorCode =
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "CONFLICT"
  | "INTERNAL_ERROR";

/** Field-level validation errors returned by multiplayer Server Actions. */
export type FieldErrors = Partial<Record<string, string[]>>;

/** Extra payload carried by a CONFLICT error when an active room blocks the action. */
export type ConflictDetails = Readonly<{ activeRoomId: string }>;

/** Discriminated application error used by multiplayer Server Actions. */
export type AppError =
  | Readonly<{
      code: "VALIDATION_ERROR";
      message: string;
      fieldErrors?: FieldErrors;
    }>
  | Readonly<{
      code: "CONFLICT";
      message: string;
      details?: ConflictDetails;
    }>
  | Readonly<{
      code: Exclude<AppErrorCode, "VALIDATION_ERROR" | "CONFLICT">;
      message: string;
    }>;

/** Generic Result type for multiplayer Server Actions. */
export type Result<T, E> =
  | Readonly<{ success: true; data: T }>
  | Readonly<{ success: false; error: E }>;

/** Build a successful multiplayer action result. */
export function ok<T>(data: T): Result<T, AppError> {
  return { success: true, data };
}

/** Build a failed multiplayer action result. */
export function fail(error: AppError): Result<never, AppError> {
  return { success: false, error };
}

/** Build a typed multiplayer action error. */
export function appError(
  code: "VALIDATION_ERROR",
  message: string,
  fieldErrors?: FieldErrors,
): AppError;
export function appError(code: "CONFLICT", message: string, details?: ConflictDetails): AppError;
export function appError(
  code: Exclude<AppErrorCode, "VALIDATION_ERROR" | "CONFLICT">,
  message: string,
): AppError;
export function appError(
  code: AppErrorCode,
  message: string,
  extra?: FieldErrors | ConflictDetails,
): AppError {
  if (code === "VALIDATION_ERROR") {
    const fieldErrors = extra as FieldErrors | undefined;
    return fieldErrors === undefined ? { code, message } : { code, message, fieldErrors };
  }

  if (code === "CONFLICT") {
    const details = extra as ConflictDetails | undefined;
    return details === undefined ? { code, message } : { code, message, details };
  }

  return { code, message };
}

/** Convert Zod issues into a field-error object keyed by top-level field name. */
export function getFieldErrors(error: ZodError): FieldErrors | undefined {
  const collected = error.issues.reduce<FieldErrors>((fieldErrors, issue) => {
    const field = issue.path[0];
    if (typeof field !== "string") {
      return fieldErrors;
    }

    const existing = fieldErrors[field] ?? [];
    return {
      ...fieldErrors,
      [field]: [...existing, issue.message],
    };
  }, {});

  return Object.keys(collected).length > 0 ? collected : undefined;
}
