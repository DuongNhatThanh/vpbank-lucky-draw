import { getAbsentParticipants, getConfirmedParticipants, getEligibleParticipants, getPendingParticipant } from "../domain/eligibility";
import { validateEventStateInvariants } from "../domain/invariants";
import type { AppState } from "./actions";
import { isSetupEventReadyForParticipantApply } from "./initialState";

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
