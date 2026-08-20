import { validateEventStateInvariants } from "../domain/invariants";
import type { AppResult, DomainError, DrawAttempt, EventPhase, EventState, Participant, Prize } from "../domain/types";

export const PERSISTENCE_KEY = "vpbank-lucky-draw:event-state";
export const SUPPORTED_STORAGE_VERSION = 1;
export const SUPPORTED_SCHEMA_VERSION = 1;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SaveEventStateOptions {
  storage?: StorageLike;
  savedAt: string;
}

export interface LoadEventStateOptions {
  storage?: StorageLike;
}

export interface ClearEventStateOptions {
  storage?: StorageLike;
}

export type LoadEventStateResult =
  | { ok: true; status: "empty" }
  | { ok: true; status: "loaded"; value: EventState }
  | { ok: false; error: DomainError };

export type SavedSessionInspection =
  | { status: "none"; reason: "no_saved_data" | "completed" | "pristine_setup" }
  | {
      status: "recoverable";
      savedAt: string;
      phase: EventPhase;
      currentPrizeIndex: number;
      hasCurrentAttempt: boolean;
    }
  | { status: "invalid"; error: DomainError };

export interface PersistedEnvelope {
  storageVersion: number;
  savedAt: string;
  state: EventState;
}

export function saveEventState(state: EventState, options: SaveEventStateOptions): AppResult<PersistedEnvelope> {
  if (!isNonEmptyString(options.savedAt)) {
    return domainError("PERSISTED_DATA_INVALID", "savedAt must be a non-empty string.", {
      savedAt: options.savedAt,
    });
  }

  const stateValidation = validateStateForSave(state);
  if (!stateValidation.ok) {
    return stateValidation;
  }

  const envelope: PersistedEnvelope = {
    storageVersion: SUPPORTED_STORAGE_VERSION,
    savedAt: options.savedAt,
    state,
  };

  const storage = resolveStorage(options.storage);
  if (!storage) {
    return domainError("PERSISTENCE_UNAVAILABLE", "Local storage is unavailable.");
  }

  try {
    storage.setItem(PERSISTENCE_KEY, JSON.stringify(envelope));
  } catch (cause) {
    return domainError("PERSISTENCE_WRITE_FAILED", "Unable to write persisted event state.", { cause });
  }

  return { ok: true, value: envelope };
}

export function loadEventState(options: LoadEventStateOptions = {}): LoadEventStateResult {
  const storage = resolveStorage(options.storage);
  if (!storage) {
    return {
      ok: false,
      error: {
        code: "PERSISTENCE_UNAVAILABLE",
        message: "Local storage is unavailable.",
      },
    };
  }

  let raw: string | null;
  try {
    raw = storage.getItem(PERSISTENCE_KEY);
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: "PERSISTENCE_READ_FAILED",
        message: "Unable to read persisted event state.",
        details: { cause },
      },
    };
  }

  if (raw === null) {
    return { ok: true, status: "empty" };
  }

  const parsedEnvelope = parsePersistedEnvelope(raw);
  if (!parsedEnvelope.ok) {
    return {
      ok: false,
      error: parsedEnvelope.error,
    };
  }

  const { storageVersion, state } = parsedEnvelope.value;
  if (storageVersion !== SUPPORTED_STORAGE_VERSION || state.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    return {
      ok: false,
      error: {
        code: "PERSISTED_DATA_VERSION_UNSUPPORTED",
        message: "Persisted storage/schema version is not supported.",
        details: {
          storageVersion,
          schemaVersion: state.schemaVersion,
        },
      },
    };
  }

  const stateValidation = validateParsedEventState(state);
  if (!stateValidation.ok) {
    return {
      ok: false,
      error: stateValidation.error,
    };
  }

  return { ok: true, status: "loaded", value: state };
}

export function clearEventState(options: ClearEventStateOptions = {}): AppResult<{ cleared: true }> {
  const storage = resolveStorage(options.storage);
  if (!storage) {
    return domainError("PERSISTENCE_UNAVAILABLE", "Local storage is unavailable.");
  }

  try {
    storage.removeItem(PERSISTENCE_KEY);
  } catch (cause) {
    return domainError("PERSISTENCE_CLEAR_FAILED", "Unable to clear persisted event state.", { cause });
  }

  return { ok: true, value: { cleared: true } };
}

export function inspectSavedSession(options: LoadEventStateOptions = {}): SavedSessionInspection {
  const storage = resolveStorage(options.storage);
  if (!storage) {
    return {
      status: "invalid",
      error: {
        code: "PERSISTENCE_UNAVAILABLE",
        message: "Local storage is unavailable.",
      },
    };
  }

  let raw: string | null;
  try {
    raw = storage.getItem(PERSISTENCE_KEY);
  } catch (cause) {
    return {
      status: "invalid",
      error: {
        code: "PERSISTENCE_READ_FAILED",
        message: "Unable to read persisted event state.",
        details: { cause },
      },
    };
  }

  if (raw === null) {
    return { status: "none", reason: "no_saved_data" };
  }

  const parsedEnvelope = parsePersistedEnvelope(raw);
  if (!parsedEnvelope.ok) {
    return { status: "invalid", error: parsedEnvelope.error };
  }

  const { storageVersion, savedAt, state } = parsedEnvelope.value;
  if (storageVersion !== SUPPORTED_STORAGE_VERSION || state.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    return {
      status: "invalid",
      error: {
        code: "PERSISTED_DATA_VERSION_UNSUPPORTED",
        message: "Persisted data version is not supported.",
        details: { storageVersion, schemaVersion: state.schemaVersion },
      },
    };
  }

  const stateValidation = validateParsedEventState(state);
  if (!stateValidation.ok) {
    return { status: "invalid", error: stateValidation.error };
  }

  if (state.phase === "eventComplete") {
    return { status: "none", reason: "completed" };
  }

  if (isPristineSetupState(state)) {
    return { status: "none", reason: "pristine_setup" };
  }

  return {
    status: "recoverable",
    savedAt,
    phase: state.phase,
    currentPrizeIndex: state.currentPrizeIndex,
    hasCurrentAttempt: state.currentAttemptId !== undefined,
  };
}

function validateStateForSave(state: EventState): AppResult<void> {
  if (state.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    return {
      ok: false,
      error: {
        code: "PERSISTED_DATA_VERSION_UNSUPPORTED",
        message: "Persisted storage/schema version is not supported.",
        details: {
          schemaVersion: state.schemaVersion,
        },
      },
    };
  }

  const validation = validateEventStateInvariants(state);
  if (!validation.valid) {
    return domainError("PERSISTED_STATE_INVALID", "Event state failed invariant validation.", {
      invariantErrors: validation.errors,
    });
  }

  return { ok: true, value: undefined };
}

function validateParsedEventState(state: EventState): AppResult<EventState> {
  const validation = validateEventStateInvariants(state);
  if (!validation.valid) {
    return domainError("PERSISTED_STATE_INVALID", "Persisted event state failed invariant validation.", {
      invariantErrors: validation.errors,
    });
  }

  return { ok: true, value: state };
}

function parsePersistedEnvelope(raw: string): AppResult<PersistedEnvelope> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (cause) {
    return domainError("PERSISTED_DATA_INVALID", "Persisted data is not valid JSON.", { cause });
  }

  if (!isObject(parsed)) {
    return domainError("PERSISTED_DATA_INVALID", "Persisted data must be an object.");
  }

  if (!isInteger(parsed.storageVersion) || !isNonEmptyString(parsed.savedAt) || !isObject(parsed.state)) {
    return domainError("PERSISTED_DATA_INVALID", "Persisted envelope is structurally invalid.");
  }

  const stateResult = parseEventState(parsed.state);
  if (!stateResult.ok) {
    return stateResult;
  }

  return {
    ok: true,
    value: {
      storageVersion: parsed.storageVersion,
      savedAt: parsed.savedAt,
      state: stateResult.value,
    },
  };
}

function parseEventState(value: unknown): AppResult<EventState> {
  if (!isObject(value)) {
    return domainError("PERSISTED_DATA_INVALID", "Persisted event state must be an object.");
  }

  if (
    !isInteger(value.schemaVersion) ||
    !isNonEmptyString(value.eventName) ||
    !isEventPhase(value.phase) ||
    !Array.isArray(value.participants) ||
    !Array.isArray(value.prizes) ||
    !isInteger(value.currentPrizeIndex) ||
    !Array.isArray(value.attempts) ||
    typeof value.configurationLocked !== "boolean" ||
    typeof value.soundEnabled !== "boolean" ||
    !isNonEmptyString(value.updatedAt)
  ) {
    return domainError("PERSISTED_DATA_INVALID", "Persisted event state is structurally invalid.");
  }

  const participantsResult = parseParticipants(value.participants);
  if (!participantsResult.ok) {
    return participantsResult;
  }

  const prizesResult = parsePrizes(value.prizes);
  if (!prizesResult.ok) {
    return prizesResult;
  }

  const attemptsResult = parseAttempts(value.attempts);
  if (!attemptsResult.ok) {
    return attemptsResult;
  }

  if (value.currentAttemptId !== undefined && !isNonEmptyString(value.currentAttemptId)) {
    return domainError("PERSISTED_DATA_INVALID", "currentAttemptId must be a non-empty string when present.");
  }

  if (value.sessionStartedAt !== undefined && !isNonEmptyString(value.sessionStartedAt)) {
    return domainError("PERSISTED_DATA_INVALID", "sessionStartedAt must be a non-empty string when present.");
  }

  const parsedState: EventState = {
    schemaVersion: value.schemaVersion,
    eventName: value.eventName,
    phase: value.phase,
    participants: participantsResult.value,
    prizes: prizesResult.value,
    currentPrizeIndex: value.currentPrizeIndex,
    attempts: attemptsResult.value,
    configurationLocked: value.configurationLocked,
    soundEnabled: value.soundEnabled,
    updatedAt: value.updatedAt,
    ...(value.currentAttemptId !== undefined ? { currentAttemptId: value.currentAttemptId } : {}),
    ...(value.sessionStartedAt !== undefined ? { sessionStartedAt: value.sessionStartedAt } : {}),
  };

  return { ok: true, value: parsedState };
}

function parseParticipants(value: readonly unknown[]): AppResult<Participant[]> {
  const participants: Participant[] = [];

  for (const entry of value) {
    if (!isObject(entry) || !isNonEmptyString(entry.id) || !isParticipantCode(entry.code) || !isParticipantStatus(entry.status)) {
      return domainError("PERSISTED_DATA_INVALID", "Persisted participant is structurally invalid.");
    }

    if (entry.name !== undefined && !isNonEmptyString(entry.name)) {
      return domainError("PERSISTED_DATA_INVALID", "Persisted participant name must be a string when present.");
    }

    participants.push({
      id: entry.id,
      code: entry.code,
      status: entry.status,
      ...(entry.name !== undefined ? { name: entry.name } : {}),
    });
  }

  return { ok: true, value: participants };
}

function parsePrizes(value: readonly unknown[]): AppResult<Prize[]> {
  const prizes: Prize[] = [];

  for (const entry of value) {
    if (
      !isObject(entry) ||
      !isNonEmptyString(entry.id) ||
      !isInteger(entry.index) ||
      !isNonEmptyString(entry.name) ||
      typeof entry.isGrandPrize !== "boolean"
    ) {
      return domainError("PERSISTED_DATA_INVALID", "Persisted prize is structurally invalid.");
    }

    prizes.push({
      id: entry.id,
      index: entry.index,
      name: entry.name,
      isGrandPrize: entry.isGrandPrize,
    });
  }

  return { ok: true, value: prizes };
}

function parseAttempts(value: readonly unknown[]): AppResult<DrawAttempt[]> {
  const attempts: DrawAttempt[] = [];

  for (const entry of value) {
    if (
      !isObject(entry) ||
      !isNonEmptyString(entry.id) ||
      !isNonEmptyString(entry.prizeId) ||
      !isNonEmptyString(entry.participantId) ||
      !isAttemptStatus(entry.status) ||
      !isNonEmptyString(entry.createdAt)
    ) {
      return domainError("PERSISTED_DATA_INVALID", "Persisted draw attempt is structurally invalid.");
    }

    if (entry.resolvedAt !== undefined && !isNonEmptyString(entry.resolvedAt)) {
      return domainError("PERSISTED_DATA_INVALID", "Persisted draw attempt resolvedAt must be a string when present.");
    }

    attempts.push({
      id: entry.id,
      prizeId: entry.prizeId,
      participantId: entry.participantId,
      status: entry.status,
      createdAt: entry.createdAt,
      ...(entry.resolvedAt !== undefined ? { resolvedAt: entry.resolvedAt } : {}),
    });
  }

  return { ok: true, value: attempts };
}

function resolveStorage(storage?: StorageLike): StorageLike | undefined {
  if (storage) {
    return storage;
  }

  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function domainError(code: DomainError["code"], message: string, details?: Record<string, unknown>): AppResult<never> {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isParticipantCode(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}$/.test(value);
}

function isParticipantStatus(value: unknown): value is Participant["status"] {
  return value === "eligible" || value === "pending" || value === "confirmed" || value === "absent";
}

function isAttemptStatus(value: unknown): value is DrawAttempt["status"] {
  return value === "pending" || value === "confirmed" || value === "absent";
}

function isEventPhase(value: unknown): value is EventPhase {
  return (
    value === "setup" ||
    value === "ready" ||
    value === "countdown" ||
    value === "drawing" ||
    value === "reelStopping" ||
    value === "pendingWinner" ||
    value === "prizeComplete" ||
    value === "eventComplete"
  );
}

function isPristineSetupState(state: EventState): boolean {
  return (
    state.phase === "setup" &&
    !state.configurationLocked &&
    state.attempts.length === 0 &&
    state.currentAttemptId === undefined &&
    state.currentPrizeIndex === 0
  );
}
