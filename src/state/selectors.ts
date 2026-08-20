import { getAbsentParticipants, getConfirmedParticipants, getEligibleParticipants, getPendingParticipant } from "../domain/eligibility";
import { validateEventStateInvariants } from "../domain/invariants";
import type { DrawAttempt, EventPhase, Participant, Prize } from "../domain/types";
import type { AppState } from "./actions";
import { isSetupEventReadyForParticipantApply } from "./initialState";

export type PrimaryOperatorAction =
  | "startCountdown"
  | "startDraw"
  | "selectWinner"
  | "finishReveal"
  | "confirmOrAbsent"
  | "advancePrize"
  | "eventComplete"
  | "none";

export interface PrizeProgress {
  current: number;
  total: number;
  label: string;
}

export interface EventHistoryItem {
  attempt: DrawAttempt;
  prize: Prize | undefined;
  participant: Participant | undefined;
}

export function selectCurrentPrize(state: AppState) {
  return state.event.prizes.find((prize) => prize.index === state.event.currentPrizeIndex);
}

export function selectEligibleParticipantCount(state: AppState): number {
  return getEligibleParticipants(state.event).length;
}

export function selectConfirmedWinnerCount(state: AppState): number {
  return getConfirmedParticipants(state.event).length;
}

export function selectAbsentParticipantCount(state: AppState): number {
  return getAbsentParticipants(state.event).length;
}

export function selectPendingParticipant(state: AppState) {
  return getPendingParticipant(state.event);
}

export function selectCurrentAttempt(state: AppState): DrawAttempt | undefined {
  return state.event.attempts.find((attempt) => attempt.id === state.event.currentAttemptId);
}

export function selectCurrentPendingWinner(state: AppState): Participant | undefined {
  const currentAttempt = selectCurrentAttempt(state);
  if (!currentAttempt || currentAttempt.status !== "pending") {
    return undefined;
  }

  return state.event.participants.find((participant) => participant.id === currentAttempt.participantId);
}

export function selectConfirmedWinners(state: AppState): EventHistoryItem[] {
  return selectEventHistory(state).filter((item) => item.attempt.status === "confirmed");
}

export function selectConfirmedWinnerForCurrentPrize(state: AppState): EventHistoryItem | undefined {
  const currentPrize = selectCurrentPrize(state);
  if (!currentPrize) {
    return undefined;
  }

  return selectConfirmedWinners(state).find((item) => item.prize?.id === currentPrize.id);
}

export function selectPrizeProgress(state: AppState): PrizeProgress {
  return {
    current: state.event.currentPrizeIndex + 1,
    total: state.event.prizes.length,
    label: `${state.event.currentPrizeIndex + 1}/${state.event.prizes.length}`,
  };
}

export function selectEventHistory(state: AppState): EventHistoryItem[] {
  return state.event.attempts
    .filter((attempt) => attempt.status === "confirmed" || attempt.status === "absent")
    .map((attempt) => ({
      attempt,
      prize: state.event.prizes.find((prize) => prize.id === attempt.prizeId),
      participant: state.event.participants.find((participant) => participant.id === attempt.participantId),
    }));
}

export function selectPrimaryOperatorAction(state: AppState): PrimaryOperatorAction {
  const actionByPhase: Record<EventPhase, PrimaryOperatorAction> = {
    setup: "none",
    ready: "startCountdown",
    countdown: "startDraw",
    drawing: "selectWinner",
    reelStopping: "finishReveal",
    pendingWinner: "confirmOrAbsent",
    prizeComplete: "advancePrize",
    eventComplete: "eventComplete",
  };

  return actionByPhase[state.event.phase];
}

export function selectCanApplyParticipants(state: AppState): boolean {
  if (state.recovery.status !== "noSession" && state.recovery.status !== "resumed") {
    return false;
  }

  if (!isSetupEventReadyForParticipantApply(state.event)) {
    return false;
  }

  if (!validateEventStateInvariants(state.event).valid) {
    return false;
  }

  const preview = state.participantPreview;
  return (
    preview !== null &&
    preview.valid.length > 0 &&
    preview.invalidRows.length === 0 &&
    preview.duplicateRows.length === 0
  );
}

export function selectCanPrepareLiveDraw(state: AppState): boolean {
  if (state.recovery.status !== "noSession" && state.recovery.status !== "resumed") {
    return false;
  }

  if (state.event.phase !== "setup" || state.event.configurationLocked || state.event.currentAttemptId !== undefined) {
    return false;
  }

  if (state.participantPreview !== null) {
    return false;
  }

  if (!validateEventStateInvariants(state.event).valid) {
    return false;
  }

  return selectEligibleParticipantCount(state) > 0;
}

export function selectCanStartLiveDraw(state: AppState): boolean {
  if (state.recovery.status !== "noSession" && state.recovery.status !== "resumed") {
    return false;
  }

  if (state.event.phase !== "ready" || state.event.currentAttemptId !== undefined) {
    return false;
  }

  if (!validateEventStateInvariants(state.event).valid) {
    return false;
  }

  return selectEligibleParticipantCount(state) > 0;
}

export function selectHasRecoverableSession(state: AppState): boolean {
  return state.recovery.status === "recoverable";
}
