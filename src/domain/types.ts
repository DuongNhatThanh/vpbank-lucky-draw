export type ParticipantStatus = "eligible" | "pending" | "confirmed" | "absent";

export interface Participant {
  id: string;
  code: string;
  name?: string;
  status: ParticipantStatus;
}

export interface Prize {
  id: string;
  index: number;
  name: string;
  isGrandPrize: boolean;
}

export type AttemptStatus = "pending" | "confirmed" | "absent";

export interface DrawAttempt {
  id: string;
  prizeId: string;
  participantId: string;
  status: AttemptStatus;
  createdAt: string;
  resolvedAt?: string;
}

export type EventPhase =
  | "setup"
  | "ready"
  | "countdown"
  | "drawing"
  | "reelStopping"
  | "pendingWinner"
  | "prizeComplete"
  | "eventComplete";

export interface EventState {
  schemaVersion: number;
  eventName: string;
  phase: EventPhase;
  participants: Participant[];
  prizes: Prize[];
  currentPrizeIndex: number;
  currentAttemptId?: string;
  attempts: DrawAttempt[];
  configurationLocked: boolean;
  soundEnabled: boolean;
  sessionStartedAt?: string;
  updatedAt: string;
}

export type DomainErrorCode =
  | "NO_ELIGIBLE_PARTICIPANTS"
  | "INVALID_RANDOM_RANGE"
  | "SECURE_RANDOM_UNAVAILABLE";

export interface DomainError {
  code: DomainErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type AppResult<T, E = DomainError> =
  | { ok: true; value: T }
  | { ok: false; error: E };
