import { getEligibleParticipants } from "./eligibility";
import { selectWinnerFromParticipants } from "./drawEngine";
import { validateEventStateInvariants, type InvariantError } from "./invariants";
import type { AppResult, DomainError, DrawAttempt, EventPhase, EventState, Participant } from "./types";

export type EventMachineCommand =
  | { type: "PREPARE_EVENT" }
  | { type: "START_COUNTDOWN" }
  | { type: "START_DRAW" }
  | { type: "SELECT_WINNER"; attemptId: string; createdAt: string }
  | { type: "FINISH_REEL_STOPPING" }
  | { type: "CONFIRM_WINNER"; resolvedAt: string }
  | { type: "MARK_WINNER_ABSENT"; resolvedAt: string }
  | { type: "ADVANCE_PRIZE" };

export type SelectWinnerFn = (participants: readonly Participant[]) => AppResult<Participant>;

export interface EventMachineDependencies {
  selectWinner?: SelectWinnerFn;
}

const defaultDependencies: Required<EventMachineDependencies> = {
  selectWinner: selectWinnerFromParticipants,
};

export function transitionEventState(
  state: EventState,
  command: EventMachineCommand,
  dependencies: EventMachineDependencies = defaultDependencies,
): AppResult<EventState> {
  const preValidation = validateEventStateInvariants(state);
  if (!preValidation.valid) {
    return invalidEventState(preValidation.errors);
  }

  const selectWinner = dependencies.selectWinner ?? defaultDependencies.selectWinner;

  switch (command.type) {
    case "PREPARE_EVENT":
      return transitionPrepareEvent(state);
    case "START_COUNTDOWN":
      return transitionStartCountdown(state);
    case "START_DRAW":
      return transitionStartDraw(state);
    case "SELECT_WINNER":
      return transitionSelectWinner(state, command, selectWinner);
    case "FINISH_REEL_STOPPING":
      return transitionFinishReelStopping(state);
    case "CONFIRM_WINNER":
      return transitionResolveWinner(state, command, "confirmed");
    case "MARK_WINNER_ABSENT":
      return transitionResolveWinner(state, command, "absent");
    case "ADVANCE_PRIZE":
      return transitionAdvancePrize(state);
    default:
      return invalidCommand("Unknown event command.", { command });
  }
}

function transitionPrepareEvent(state: EventState): AppResult<EventState> {
  if (state.phase !== "setup") {
    return invalidPhaseTransition("PREPARE_EVENT is only valid from setup.", {
      phase: state.phase,
    });
  }

  if (state.currentAttemptId !== undefined) {
    return invalidCurrentAttempt("Setup state must not carry a current attempt.", {
      currentAttemptId: state.currentAttemptId,
    });
  }

  return validateCandidate({
    ...state,
    phase: "ready",
  });
}

function transitionStartCountdown(state: EventState): AppResult<EventState> {
  if (state.phase !== "ready") {
    return invalidPhaseTransition("START_COUNTDOWN is only valid from ready.", {
      phase: state.phase,
    });
  }

  if (state.currentAttemptId !== undefined) {
    return invalidCurrentAttempt("START_COUNTDOWN requires no current attempt.", {
      currentAttemptId: state.currentAttemptId,
    });
  }

  if (getEligibleParticipants(state).length === 0) {
    return domainError("NO_ELIGIBLE_PARTICIPANTS", "No eligible participants are available for countdown.");
  }

  return validateCandidate({
    ...state,
    phase: "countdown",
    configurationLocked: true,
  });
}

function transitionStartDraw(state: EventState): AppResult<EventState> {
  if (state.phase !== "countdown") {
    return invalidPhaseTransition("START_DRAW is only valid from countdown.", {
      phase: state.phase,
    });
  }

  if (state.currentAttemptId !== undefined) {
    return invalidCurrentAttempt("START_DRAW requires no current attempt.", {
      currentAttemptId: state.currentAttemptId,
    });
  }

  return validateCandidate({
    ...state,
    phase: "drawing",
  });
}

function transitionSelectWinner(
  state: EventState,
  command: Extract<EventMachineCommand, { type: "SELECT_WINNER" }>,
  selectWinner: SelectWinnerFn,
): AppResult<EventState> {
  if (state.phase !== "drawing") {
    return invalidPhaseTransition("SELECT_WINNER is only valid from drawing.", {
      phase: state.phase,
    });
  }

  if (state.currentAttemptId !== undefined) {
    return invalidCurrentAttempt("SELECT_WINNER requires no current attempt before selection.", {
      currentAttemptId: state.currentAttemptId,
    });
  }

  if (!isNonEmptyString(command.attemptId) || !isNonEmptyString(command.createdAt)) {
    return invalidCommand("SELECT_WINNER requires attemptId and createdAt.", {
      attemptId: command.attemptId,
      createdAt: command.createdAt,
    });
  }

  if (state.attempts.some((attempt) => attempt.id === command.attemptId)) {
    return invalidCommand("SELECT_WINNER requires a unique attempt id.", {
      attemptId: command.attemptId,
    });
  }

  const selectionResult = selectWinner(state.participants);
  if (!selectionResult.ok) {
    return selectionResult;
  }

  const selectedParticipant = selectionResult.value;
  const eligibleIds = new Set(getEligibleParticipants(state).map((participant) => participant.id));
  if (!eligibleIds.has(selectedParticipant.id)) {
    return invalidWinnerSelection("Selected participant must come from the current eligible pool.", {
      selectedParticipantId: selectedParticipant.id,
    });
  }

  const participantIndex = state.participants.findIndex((participant) => participant.id === selectedParticipant.id);
  if (participantIndex < 0) {
    return invalidWinnerSelection("Selected participant must exist in state.", {
      selectedParticipantId: selectedParticipant.id,
    });
  }

  if (state.participants[participantIndex]?.status !== "eligible") {
    return invalidWinnerSelection("Selected participant must still be eligible.", {
      selectedParticipantId: selectedParticipant.id,
      participantStatus: state.participants[participantIndex]?.status,
    });
  }

  const currentPrize = currentPrizeFromState(state);
  if (!currentPrize) {
    return invalidEventState([{ code: "CURRENT_PRIZE_INDEX_OUT_OF_RANGE", message: "Current prize is missing." }]);
  }

  const nextParticipants = state.participants.map((participant, index) =>
    index === participantIndex ? { ...participant, status: "pending" as const } : participant,
  );

  const nextAttempts = [
    ...state.attempts,
    {
      id: command.attemptId,
      prizeId: currentPrize.id,
      participantId: selectedParticipant.id,
      status: "pending" as const,
      createdAt: command.createdAt,
    },
  ];

  return validateCandidate({
    ...state,
    phase: "reelStopping",
    currentAttemptId: command.attemptId,
    participants: nextParticipants,
    attempts: nextAttempts,
  });
}

function transitionFinishReelStopping(state: EventState): AppResult<EventState> {
  if (state.phase !== "reelStopping") {
    return invalidPhaseTransition("FINISH_REEL_STOPPING is only valid from reelStopping.", {
      phase: state.phase,
    });
  }

  if (state.currentAttemptId === undefined) {
    return invalidCurrentAttempt("FINISH_REEL_STOPPING requires a current attempt.", {
      currentAttemptId: state.currentAttemptId,
    });
  }

  return validateCandidate({
    ...state,
    phase: "pendingWinner",
  });
}

function transitionResolveWinner(
  state: EventState,
  command: Extract<EventMachineCommand, { type: "CONFIRM_WINNER" | "MARK_WINNER_ABSENT" }>,
  nextStatus: "confirmed" | "absent",
): AppResult<EventState> {
  if (state.phase !== "pendingWinner") {
    return invalidPhaseTransition(`${command.type} is only valid from pendingWinner.`, {
      phase: state.phase,
    });
  }

  const pendingAttempt = currentPendingAttempt(state);
  if (!pendingAttempt) {
    return invalidCurrentAttempt("Pending winner state requires a pending attempt.", {
      currentAttemptId: state.currentAttemptId,
    });
  }

  if (state.currentAttemptId !== pendingAttempt.id) {
    return invalidCurrentAttempt("Current attempt id must match the pending attempt.", {
      currentAttemptId: state.currentAttemptId,
      pendingAttemptId: pendingAttempt.id,
    });
  }

  if (!isNonEmptyString(command.resolvedAt)) {
    return invalidCommand(`${command.type} requires a non-empty resolvedAt.`, {
      resolvedAt: command.resolvedAt,
    });
  }

  const currentPrize = currentPrizeFromState(state);
  if (!currentPrize || pendingAttempt.prizeId !== currentPrize.id) {
    return invalidCurrentAttempt("Pending attempt must belong to the current prize.", {
      currentPrizeId: currentPrize?.id,
      pendingAttemptPrizeId: pendingAttempt.prizeId,
    });
  }

  const participantIndex = state.participants.findIndex((participant) => participant.id === pendingAttempt.participantId);
  if (participantIndex < 0) {
    return invalidCurrentAttempt("Pending attempt participant must exist.", {
      participantId: pendingAttempt.participantId,
    });
  }

  const participant = state.participants[participantIndex];
  if (participant?.status !== "pending") {
    return invalidCurrentAttempt("Pending attempt participant must still be pending.", {
      participantStatus: participant?.status,
    });
  }

  const nextParticipants = state.participants.map((currentParticipant, index) =>
    index === participantIndex ? { ...currentParticipant, status: nextStatus } : currentParticipant,
  );

  const nextAttempts = state.attempts.map((attempt) =>
    attempt.id === pendingAttempt.id
      ? {
          ...attempt,
          status: nextStatus,
          resolvedAt: command.resolvedAt,
        }
      : attempt,
  );

  const nextPhase: EventPhase = nextStatus === "confirmed" ? "prizeComplete" : "ready";
  const { currentAttemptId: _currentAttemptId, ...baseState } = state;

  return validateCandidate({
    ...baseState,
    phase: nextPhase,
    participants: nextParticipants,
    attempts: nextAttempts,
  });
}

function transitionAdvancePrize(state: EventState): AppResult<EventState> {
  if (state.phase !== "prizeComplete") {
    return invalidPhaseTransition("ADVANCE_PRIZE is only valid from prizeComplete.", {
      phase: state.phase,
    });
  }

  if (state.currentAttemptId !== undefined) {
    return invalidCurrentAttempt("Prize complete state must not carry a current attempt.", {
      currentAttemptId: state.currentAttemptId,
    });
  }

  const currentPrize = currentPrizeFromState(state);
  if (!currentPrize) {
    return invalidEventState([{ code: "CURRENT_PRIZE_INDEX_OUT_OF_RANGE", message: "Current prize is missing." }]);
  }

  const confirmedAttemptsForCurrentPrize = state.attempts.filter(
    (attempt) => attempt.prizeId === currentPrize.id && attempt.status === "confirmed",
  );
  if (confirmedAttemptsForCurrentPrize.length !== 1) {
    return currentPrizeIncomplete({
      currentPrizeId: currentPrize.id,
      confirmedCount: confirmedAttemptsForCurrentPrize.length,
    });
  }

  const nextPhase: EventPhase = state.currentPrizeIndex >= 5 ? "eventComplete" : "ready";
  const nextPrizeIndex = state.currentPrizeIndex >= 5 ? 5 : state.currentPrizeIndex + 1;
  const { currentAttemptId: _currentAttemptId, ...baseState } = state;

  return validateCandidate({
    ...baseState,
    phase: nextPhase,
    currentPrizeIndex: nextPrizeIndex,
  });
}

function validateCandidate(candidate: EventState): AppResult<EventState> {
  const validation = validateEventStateInvariants(candidate);
  if (!validation.valid) {
    return invalidEventState(validation.errors);
  }

  return { ok: true, value: candidate };
}

function currentPrizeFromState(state: EventState) {
  return state.prizes.find((prize) => prize.index === state.currentPrizeIndex);
}

function currentPendingAttempt(state: EventState): DrawAttempt | undefined {
  return state.attempts.find((attempt) => attempt.id === state.currentAttemptId && attempt.status === "pending");
}

function invalidEventState(errors: InvariantError[]): AppResult<EventState> {
  return domainError("INVALID_EVENT_STATE", "Incoming or outgoing state violated an invariant.", {
    invariantErrors: errors,
  });
}

function invalidPhaseTransition(message: string, details?: Record<string, unknown>): AppResult<EventState> {
  return domainError("INVALID_PHASE_TRANSITION", message, details);
}

function invalidCurrentAttempt(message: string, details?: Record<string, unknown>): AppResult<EventState> {
  return domainError("INVALID_CURRENT_ATTEMPT", message, details);
}

function currentPrizeIncomplete(details?: Record<string, unknown>): AppResult<EventState> {
  return domainError("CURRENT_PRIZE_INCOMPLETE", "Current prize is not complete.", details);
}

function invalidCommand(message: string, details?: Record<string, unknown>): AppResult<EventState> {
  return domainError("INVALID_COMMAND", message, details);
}

function invalidWinnerSelection(message: string, details?: Record<string, unknown>): AppResult<EventState> {
  return domainError("INVALID_WINNER_SELECTION", message, details);
}

function domainError(code: DomainError["code"], message: string, details?: Record<string, unknown>): AppResult<EventState> {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
