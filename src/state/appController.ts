import { applyParticipantsToEventState, type ParticipantValidationResult } from "../domain/participantValidation";
import { transitionEventState } from "../domain/eventMachine";
import type { AppResult } from "../domain/types";
import { clearEventState, inspectSavedSession, loadEventState, saveEventState, type StorageLike } from "../services/persistence";
import type { AppState, NoSessionRecoveryState } from "./actions";
import { appReducer } from "./appReducer";
import { createInitialAppState, createInitialEventState } from "./initialState";
import { selectCanApplyParticipants, selectCanPrepareLiveDraw } from "./selectors";

export interface InitializeAppOptions {
  storage?: StorageLike;
  now: string;
}

export interface ApplyParticipantsOptions {
  storage?: StorageLike;
  savedAt: string;
}

export interface ResumeSavedSessionOptions {
  storage?: StorageLike;
}

export interface StartNewSessionOptions {
  storage?: StorageLike;
  now: string;
}

export interface PrepareEventOptions {
  storage?: StorageLike;
  savedAt: string;
}

export function initializeAppState(options: InitializeAppOptions): AppState {
  const baseState = createInitialAppState(options.now);
  const inspection = inspectSavedSession(toStorageOptions(options.storage));

  if (inspection.status === "recoverable") {
    return appReducer(baseState, {
      type: "INITIALIZE_APP",
      recovery: {
        status: "recoverable",
        savedAt: inspection.savedAt,
        phase: inspection.phase,
        currentPrizeIndex: inspection.currentPrizeIndex,
        hasCurrentAttempt: inspection.hasCurrentAttempt,
      },
      error: null,
    });
  }

  if (inspection.status === "none") {
    return appReducer(baseState, {
      type: "INITIALIZE_APP",
      recovery: {
        status: "noSession",
        reason: inspection.reason,
      },
      error: null,
    });
  }

  return appReducer(baseState, {
    type: "INITIALIZE_APP",
    recovery: {
      status: "invalid",
      error: inspection.error,
    },
    error: inspection.error,
  });
}

export function setParticipantPreview(state: AppState, preview: ParticipantValidationResult): AppState {
  return appReducer(state, { type: "SET_PARTICIPANT_PREVIEW", preview });
}

export function clearParticipantPreview(state: AppState): AppState {
  return appReducer(state, { type: "CLEAR_PARTICIPANT_PREVIEW" });
}

export function clearApplicationError(state: AppState): AppState {
  return appReducer(state, { type: "CLEAR_ERROR" });
}

export function applyParticipantsToAppState(
  state: AppState,
  validationResult: ParticipantValidationResult,
  options: ApplyParticipantsOptions,
): AppResult<AppState> {
  if (state.recovery.status !== "noSession" && state.recovery.status !== "resumed") {
    return invalidCommand("Resolve startup recovery before applying participants.", {
      recoveryStatus: state.recovery.status,
    });
  }

  if (!selectCanApplyParticipants({
    ...state,
    participantPreview: validationResult,
  })) {
    return invalidCommand("Participant preview must be valid before apply.", {
      invalidRows: validationResult.invalidRows,
      duplicateRows: validationResult.duplicateRows,
      validCount: validationResult.valid.length,
    });
  }

  const candidateResult = applyParticipantsToEventState(state.event, validationResult);
  if (!candidateResult.ok) {
    return {
      ok: false,
      error: candidateResult.error,
    };
  }

  const persistResult = saveEventState(candidateResult.value, {
    savedAt: options.savedAt,
    ...toStorageOptions(options.storage),
  });
  if (!persistResult.ok) {
    return {
      ok: false,
      error: persistResult.error,
    };
  }

  return {
    ok: true,
    value: appReducer(state, {
      type: "APPLY_PARTICIPANTS",
      event: candidateResult.value,
    }),
  };
}

export function prepareEventForLiveDraw(state: AppState, options: PrepareEventOptions): AppResult<AppState> {
  if (!selectCanPrepareLiveDraw(state)) {
    return invalidCommand("The event is not ready to enter the live draw flow.", {
      recoveryStatus: state.recovery.status,
      phase: state.event.phase,
      previewPresent: state.participantPreview !== null,
    });
  }

  const transitionResult = transitionEventState(state.event, { type: "PREPARE_EVENT" });
  if (!transitionResult.ok) {
    return {
      ok: false,
      error: transitionResult.error,
    };
  }

  const persistResult = saveEventState(transitionResult.value, {
    savedAt: options.savedAt,
    ...toStorageOptions(options.storage),
  });
  if (!persistResult.ok) {
    return {
      ok: false,
      error: persistResult.error,
    };
  }

  return {
    ok: true,
    value: appReducer(state, {
      type: "PREPARE_LIVE_DRAW",
      event: transitionResult.value,
    }),
  };
}

export function resumeSavedSession(state: AppState, options: ResumeSavedSessionOptions = {}): AppResult<AppState> {
  if (state.recovery.status !== "recoverable") {
    return invalidCommand("A recoverable saved session is required before resume.", {
      recoveryStatus: state.recovery.status,
    });
  }

  const loadResult = loadEventState(toStorageOptions(options.storage));
  if (!loadResult.ok) {
    return {
      ok: false,
      error: loadResult.error,
    };
  }

  if (loadResult.status !== "loaded") {
    return invalidCommand("No recoverable session is available to resume.");
  }

  return {
    ok: true,
    value: appReducer(state, {
      type: "RESUME_SAVED_SESSION",
      event: loadResult.value,
    }),
  };
}

export function startNewSession(state: AppState, options: StartNewSessionOptions): AppResult<AppState> {
  const clearResult = clearEventState(toStorageOptions(options.storage));
  if (!clearResult.ok) {
    return {
      ok: false,
      error: clearResult.error,
    };
  }

  const freshEvent = createInitialEventState(options.now);
  const nextState = appReducer(state, {
    type: "START_NEW_SESSION",
    event: freshEvent,
    recovery: {
      status: "noSession",
      reason: "no_saved_data",
    } satisfies NoSessionRecoveryState,
  });

  return { ok: true, value: nextState };
}

function invalidCommand(message: string, details?: Record<string, unknown>): AppResult<never> {
  return {
    ok: false,
    error: {
      code: "INVALID_COMMAND",
      message,
      ...(details ? { details } : {}),
    },
  };
}

function toStorageOptions(storage?: StorageLike): { storage?: StorageLike } {
  return storage ? { storage } : {};
}
