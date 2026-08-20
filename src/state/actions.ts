import type { DomainError, EventPhase, EventState } from "../domain/types";
import type { ParticipantValidationResult } from "../domain/participantValidation";

export interface AppState {
  event: EventState;
  participantPreview: ParticipantValidationResult | null;
  recovery: RecoveryState;
  error: AppError | null;
}

export type AppError = DomainError;

export type RecoveryState =
  | CheckingRecoveryState
  | NoSessionRecoveryState
  | RecoverableRecoveryState
  | InvalidRecoveryState
  | ResumedRecoveryState;

export interface CheckingRecoveryState {
  status: "checking";
}

export interface NoSessionRecoveryState {
  status: "noSession";
  reason: "no_saved_data" | "completed" | "pristine_setup";
}

export interface RecoverableRecoveryState {
  status: "recoverable";
  savedAt: string;
  phase: EventPhase;
  currentPrizeIndex: number;
  hasCurrentAttempt: boolean;
}

export interface InvalidRecoveryState {
  status: "invalid";
  error: DomainError;
}

export interface ResumedRecoveryState {
  status: "resumed";
}

export type AppAction =
  | {
      type: "INITIALIZE_APP";
      recovery: RecoveryState;
      error: AppError | null;
    }
  | {
      type: "SET_PARTICIPANT_PREVIEW";
      preview: ParticipantValidationResult;
    }
  | {
      type: "CLEAR_PARTICIPANT_PREVIEW";
    }
  | {
      type: "APPLY_PARTICIPANTS";
      event: EventState;
    }
  | {
      type: "PREPARE_LIVE_DRAW";
      event: EventState;
    }
  | {
      type: "RESUME_SAVED_SESSION";
      event: EventState;
    }
  | {
      type: "START_NEW_SESSION";
      event: EventState;
      recovery: NoSessionRecoveryState;
    }
  | {
      type: "CLEAR_ERROR";
    };
