import { validateEventStateInvariants } from "./invariants";
import type { AppResult, DomainError, EventState, Participant } from "./types";

export interface RawParticipantRow {
  code: unknown;
  name?: unknown;
  sourceRow: number;
}

export interface ParticipantImportIssue {
  sourceRow: number;
  reason: ParticipantImportIssueReason;
  message: string;
  code?: string;
  name?: string;
}

export type ParticipantImportIssueReason = "malformed_row" | "invalid_code" | "invalid_name" | "duplicate_code";

export interface ParticipantValidationResult {
  received: number;
  valid: Participant[];
  duplicateRows: ParticipantImportIssue[];
  invalidRows: ParticipantImportIssue[];
}

export function validateParticipantRows(rows: readonly RawParticipantRow[]): ParticipantValidationResult {
  const received = rows.length;
  const validCandidates: Array<{ participant: Participant; sourceRow: number }> = [];
  const invalidRows: ParticipantImportIssue[] = [];

  for (const row of rows) {
    const codeResult = normalizeParticipantCode(row.code);
    if (!codeResult.ok) {
      invalidRows.push({
        sourceRow: row.sourceRow,
        reason: "invalid_code",
        message: codeResult.error.message,
        ...(typeof row.code === "string" ? { code: row.code } : {}),
      });
      continue;
    }

    const nameResult = normalizeParticipantName(row.name);
    if (!nameResult.ok) {
      invalidRows.push({
        sourceRow: row.sourceRow,
        reason: "invalid_name",
        message: nameResult.error.message,
        code: codeResult.value,
        ...(typeof row.name === "string" ? { name: row.name } : {}),
      });
      continue;
    }

    validCandidates.push({
      sourceRow: row.sourceRow,
      participant: {
        id: participantIdFromCode(codeResult.value),
        code: codeResult.value,
        status: "eligible",
        ...(nameResult.value !== undefined ? { name: nameResult.value } : {}),
      },
    });
  }

  const candidateCounts = new Map<string, number>();
  for (const candidate of validCandidates) {
    candidateCounts.set(candidate.participant.code, (candidateCounts.get(candidate.participant.code) ?? 0) + 1);
  }

  const duplicateRows: ParticipantImportIssue[] = [];
  const valid: Participant[] = [];
  for (const candidate of validCandidates) {
    const count = candidateCounts.get(candidate.participant.code) ?? 0;
    if (count > 1) {
      duplicateRows.push({
        sourceRow: candidate.sourceRow,
        reason: "duplicate_code",
        message: "Participant code must be unique.",
        code: candidate.participant.code,
        ...(candidate.participant.name !== undefined ? { name: candidate.participant.name } : {}),
      });
      continue;
    }

    valid.push(candidate.participant);
  }

  return {
    received,
    valid,
    duplicateRows,
    invalidRows,
  };
}

export function applyParticipantsToEventState(
  state: EventState,
  validationResult: ParticipantValidationResult,
): AppResult<EventState> {
  if (state.phase !== "setup" || state.configurationLocked || state.attempts.length > 0 || state.currentAttemptId !== undefined || state.currentPrizeIndex !== 0) {
    return domainError("INVALID_EVENT_STATE", "Participant configuration can only be applied to a pristine setup state.", {
      phase: state.phase,
      configurationLocked: state.configurationLocked,
      attempts: state.attempts.length,
      currentAttemptId: state.currentAttemptId,
      currentPrizeIndex: state.currentPrizeIndex,
    });
  }

  if (validationResult.invalidRows.length > 0 || validationResult.duplicateRows.length > 0) {
    return domainError("INVALID_EVENT_STATE", "Participant validation must succeed before apply.", {
      invalidRows: validationResult.invalidRows,
      duplicateRows: validationResult.duplicateRows,
    });
  }

  if (validationResult.valid.length === 0) {
    return domainError("INVALID_EVENT_STATE", "At least one valid participant is required before apply.");
  }

  const nextParticipants = validationResult.valid.map((participant) => ({
    ...participant,
    status: "eligible" as const,
  }));

  const nextState: EventState = {
    ...state,
    participants: nextParticipants,
  };

  const invariantResult = validateEventStateInvariants(nextState);
  if (!invariantResult.valid) {
    return domainError("INVALID_EVENT_STATE", "Applied participant state failed domain invariant validation.", {
      invariantErrors: invariantResult.errors,
    });
  }

  return { ok: true, value: nextState };
}

function normalizeParticipantCode(value: unknown): AppResult<string> {
  if (typeof value !== "string") {
    return domainError("INVALID_EVENT_STATE", "Participant code must be a string.");
  }

  const normalized = value.trim();
  if (!/^\d{4}$/.test(normalized)) {
    return domainError("INVALID_EVENT_STATE", "Participant code must contain exactly four digits.");
  }

  return { ok: true, value: normalized };
}

function normalizeParticipantName(value: unknown): AppResult<string | undefined> {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }

  if (typeof value !== "string") {
    return domainError("INVALID_EVENT_STATE", "Participant name must be a string when present.");
  }

  const normalized = value.trim();
  return { ok: true, value: normalized.length > 0 ? normalized : undefined };
}

function participantIdFromCode(code: string): string {
  return `participant-${code}`;
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
