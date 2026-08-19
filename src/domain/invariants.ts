import type { EventState } from "./types";

export type InvariantErrorCode =
  | "INVALID_PRIZE_COUNT"
  | "INVALID_PRIZE_INDEX"
  | "DUPLICATE_PRIZE_INDEX"
  | "CURRENT_PRIZE_INDEX_OUT_OF_RANGE"
  | "ATTEMPT_PARTICIPANT_NOT_FOUND"
  | "ATTEMPT_PRIZE_NOT_FOUND"
  | "MULTIPLE_PENDING_ATTEMPTS"
  | "MULTIPLE_PENDING_PARTICIPANTS"
  | "PENDING_ATTEMPT_PARTICIPANT_MISMATCH"
  | "PENDING_ATTEMPT_PRIZE_MISMATCH"
  | "PENDING_WINNER_PENDING_ATTEMPT_COUNT"
  | "PENDING_WINNER_PENDING_PARTICIPANT_COUNT"
  | "PENDING_WINNER_CURRENT_ATTEMPT_MISMATCH"
  | "CURRENT_ATTEMPT_NOT_FOUND"
  | "CONFIRMED_ATTEMPT_PARTICIPANT_ELIGIBLE"
  | "CONFIRMED_ATTEMPT_PARTICIPANT_STATUS_MISMATCH"
  | "ABSENT_ATTEMPT_PARTICIPANT_ELIGIBLE"
  | "ABSENT_ATTEMPT_PARTICIPANT_STATUS_MISMATCH"
  | "MULTIPLE_CONFIRMED_ATTEMPTS_FOR_PRIZE"
  | "PARTICIPANT_CONFIRMED_MULTIPLE_PRIZES"
  | "ADVANCED_WITH_INCOMPLETE_PRIZE"
  | "PRIZE_COMPLETE_PENDING_ATTEMPT_EXISTS"
  | "PRIZE_COMPLETE_CONFIRMED_ATTEMPT_COUNT"
  | "EVENT_COMPLETE_CONFIRMED_WINNER_COUNT"
  | "EVENT_COMPLETE_PRIZE_CONFIRMED_ATTEMPT_COUNT"
  | "EVENT_COMPLETE_DUPLICATE_CONFIRMED_PARTICIPANT"
  | "EVENT_COMPLETE_PENDING_ATTEMPT_EXISTS";

export interface InvariantError {
  code: InvariantErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface InvariantValidationResult {
  valid: boolean;
  errors: InvariantError[];
}

const REQUIRED_PRIZE_COUNT = 6;
const FIRST_PRIZE_INDEX = 0;
const LAST_PRIZE_INDEX = 5;

export function validateEventStateInvariants(state: EventState): InvariantValidationResult {
  const errors: InvariantError[] = [];
  const prizeById = new Map(state.prizes.map((prize) => [prize.id, prize]));
  const participantById = new Map(state.participants.map((participant) => [participant.id, participant]));

  validatePrizeShape(state, errors);
  validateAttemptReferences(state, prizeById, participantById, errors);
  validatePendingState(state, prizeById, participantById, errors);
  validateResolvedAttemptEligibility(state, participantById, errors);
  validatePrizeCompletion(state, errors);
  validatePhaseSpecificInvariants(state, errors);

  return { valid: errors.length === 0, errors };
}

function validatePrizeShape(state: EventState, errors: InvariantError[]): void {
  if (state.prizes.length !== REQUIRED_PRIZE_COUNT) {
    errors.push({
      code: "INVALID_PRIZE_COUNT",
      message: "Event must define exactly six prizes.",
      details: { count: state.prizes.length },
    });
  }

  if (state.currentPrizeIndex < FIRST_PRIZE_INDEX || state.currentPrizeIndex > LAST_PRIZE_INDEX) {
    errors.push({
      code: "CURRENT_PRIZE_INDEX_OUT_OF_RANGE",
      message: "Current prize index must stay within 0..5.",
      details: { currentPrizeIndex: state.currentPrizeIndex },
    });
  }

  const seenIndexes = new Set<number>();
  for (const prize of state.prizes) {
    if (prize.index < FIRST_PRIZE_INDEX || prize.index > LAST_PRIZE_INDEX) {
      errors.push({
        code: "INVALID_PRIZE_INDEX",
        message: "Prize index must stay within 0..5.",
        details: { prizeId: prize.id, index: prize.index },
      });
    }

    if (seenIndexes.has(prize.index)) {
      errors.push({
        code: "DUPLICATE_PRIZE_INDEX",
        message: "Prize indexes must be unique.",
        details: { index: prize.index },
      });
    }

    seenIndexes.add(prize.index);
  }
}

function validateAttemptReferences(
  state: EventState,
  prizeById: ReadonlyMap<string, unknown>,
  participantById: ReadonlyMap<string, unknown>,
  errors: InvariantError[],
): void {
  for (const attempt of state.attempts) {
    if (!participantById.has(attempt.participantId)) {
      errors.push({
        code: "ATTEMPT_PARTICIPANT_NOT_FOUND",
        message: "Every draw attempt must reference an existing participant.",
        details: { attemptId: attempt.id, participantId: attempt.participantId },
      });
    }

    if (!prizeById.has(attempt.prizeId)) {
      errors.push({
        code: "ATTEMPT_PRIZE_NOT_FOUND",
        message: "Every draw attempt must reference an existing prize.",
        details: { attemptId: attempt.id, prizeId: attempt.prizeId },
      });
    }
  }
}

function validatePendingState(
  state: EventState,
  prizeById: ReadonlyMap<string, { index: number }>,
  participantById: ReadonlyMap<string, { status: string }>,
  errors: InvariantError[],
): void {
  const pendingAttempts = state.attempts.filter((attempt) => attempt.status === "pending");
  const pendingParticipants = state.participants.filter((participant) => participant.status === "pending");

  if (pendingAttempts.length > 1) {
    errors.push({
      code: "MULTIPLE_PENDING_ATTEMPTS",
      message: "At most one pending draw attempt may exist.",
      details: { count: pendingAttempts.length },
    });
  }

  if (pendingParticipants.length > 1) {
    errors.push({
      code: "MULTIPLE_PENDING_PARTICIPANTS",
      message: "At most one pending participant may exist.",
      details: { count: pendingParticipants.length },
    });
  }

  const pendingAttempt = pendingAttempts[0];
  const pendingParticipant = pendingParticipants[0];

  if (pendingAttempt && (!pendingParticipant || pendingAttempt.participantId !== pendingParticipant.id)) {
    errors.push({
      code: "PENDING_ATTEMPT_PARTICIPANT_MISMATCH",
      message: "Pending attempt and pending participant must identify the same participant.",
      details: {
        attemptParticipantId: pendingAttempt.participantId,
        pendingParticipantId: pendingParticipant?.id,
      },
    });
  }

  if (pendingParticipant && (!pendingAttempt || pendingAttempt.participantId !== pendingParticipant.id)) {
    errors.push({
      code: "PENDING_ATTEMPT_PARTICIPANT_MISMATCH",
      message: "Pending participant must have a matching pending attempt.",
      details: {
        pendingParticipantId: pendingParticipant.id,
        attemptParticipantId: pendingAttempt?.participantId,
      },
    });
  }

  if (pendingAttempt) {
    const pendingPrize = prizeById.get(pendingAttempt.prizeId);
    if (pendingPrize && pendingPrize.index !== state.currentPrizeIndex) {
      errors.push({
        code: "PENDING_ATTEMPT_PRIZE_MISMATCH",
        message: "Current prize cannot advance while an attempt is pending.",
        details: {
          currentPrizeIndex: state.currentPrizeIndex,
          pendingPrizeIndex: pendingPrize.index,
        },
      });
    }

    const participant = participantById.get(pendingAttempt.participantId);
    if (participant && participant.status !== "pending") {
      errors.push({
        code: "PENDING_ATTEMPT_PARTICIPANT_MISMATCH",
        message: "Pending attempt participant must have pending status.",
        details: {
          participantId: pendingAttempt.participantId,
          participantStatus: participant.status,
        },
      });
    }
  }

  if (state.phase === "pendingWinner") {
    if (pendingAttempts.length !== 1) {
      errors.push({
        code: "PENDING_WINNER_PENDING_ATTEMPT_COUNT",
        message: "Pending winner phase requires exactly one pending attempt.",
        details: { count: pendingAttempts.length },
      });
    }

    if (pendingParticipants.length !== 1) {
      errors.push({
        code: "PENDING_WINNER_PENDING_PARTICIPANT_COUNT",
        message: "Pending winner phase requires exactly one pending participant.",
        details: { count: pendingParticipants.length },
      });
    }

    if (!pendingAttempt || state.currentAttemptId !== pendingAttempt.id) {
      errors.push({
        code: "PENDING_WINNER_CURRENT_ATTEMPT_MISMATCH",
        message: "Pending winner phase requires currentAttemptId to match the pending attempt.",
        details: {
          currentAttemptId: state.currentAttemptId,
          pendingAttemptId: pendingAttempt?.id,
        },
      });
    }
  }

  if (state.currentAttemptId && !state.attempts.some((attempt) => attempt.id === state.currentAttemptId)) {
    errors.push({
      code: "CURRENT_ATTEMPT_NOT_FOUND",
      message: "Current attempt id must reference an existing attempt.",
      details: { currentAttemptId: state.currentAttemptId },
    });
  }
}

function validateResolvedAttemptEligibility(
  state: EventState,
  participantById: ReadonlyMap<string, { status: string }>,
  errors: InvariantError[],
): void {
  for (const attempt of state.attempts) {
    const participant = participantById.get(attempt.participantId);

    if (attempt.status === "confirmed" && participant?.status === "eligible") {
      errors.push({
        code: "CONFIRMED_ATTEMPT_PARTICIPANT_ELIGIBLE",
        message: "Confirmed participants must not remain eligible.",
        details: { participantId: attempt.participantId, attemptId: attempt.id },
      });
    }

    if (attempt.status === "confirmed" && participant && participant.status !== "confirmed") {
      errors.push({
        code: "CONFIRMED_ATTEMPT_PARTICIPANT_STATUS_MISMATCH",
        message: "A confirmed attempt must reference a participant with confirmed status.",
        details: {
          participantId: attempt.participantId,
          attemptId: attempt.id,
          participantStatus: participant.status,
        },
      });
    }

    if (attempt.status === "absent" && participant?.status === "eligible") {
      errors.push({
        code: "ABSENT_ATTEMPT_PARTICIPANT_ELIGIBLE",
        message: "Absent participants must not remain eligible.",
        details: { participantId: attempt.participantId, attemptId: attempt.id },
      });
    }

    if (attempt.status === "absent" && participant && participant.status !== "absent") {
      errors.push({
        code: "ABSENT_ATTEMPT_PARTICIPANT_STATUS_MISMATCH",
        message: "An absent attempt must reference a participant with absent status.",
        details: {
          participantId: attempt.participantId,
          attemptId: attempt.id,
          participantStatus: participant.status,
        },
      });
    }
  }
}

function validatePrizeCompletion(state: EventState, errors: InvariantError[]): void {
  const confirmedByPrizeId = new Map<string, number>();
  const confirmedPrizeIdsByParticipantId = new Map<string, Set<string>>();

  for (const attempt of state.attempts) {
    if (attempt.status === "confirmed") {
      confirmedByPrizeId.set(attempt.prizeId, (confirmedByPrizeId.get(attempt.prizeId) ?? 0) + 1);

      const prizeIds = confirmedPrizeIdsByParticipantId.get(attempt.participantId) ?? new Set<string>();
      prizeIds.add(attempt.prizeId);
      confirmedPrizeIdsByParticipantId.set(attempt.participantId, prizeIds);
    }
  }

  for (const [prizeId, count] of confirmedByPrizeId.entries()) {
    if (count > 1) {
      errors.push({
        code: "MULTIPLE_CONFIRMED_ATTEMPTS_FOR_PRIZE",
        message: "A completed prize cannot have multiple confirmed attempts.",
        details: { prizeId, count },
      });
    }
  }

  for (const [participantId, prizeIds] of confirmedPrizeIdsByParticipantId.entries()) {
    if (prizeIds.size > 1) {
      errors.push({
        code: "PARTICIPANT_CONFIRMED_MULTIPLE_PRIZES",
        message: "The same participant cannot have confirmed attempts for more than one prize.",
        details: { participantId, prizeIds: [...prizeIds] },
      });
    }
  }

  for (const prize of state.prizes) {
    const confirmedCount = confirmedByPrizeId.get(prize.id) ?? 0;
    if (prize.index < state.currentPrizeIndex && confirmedCount !== 1) {
      errors.push({
        code: "ADVANCED_WITH_INCOMPLETE_PRIZE",
        message: "Current prize cannot advance past an incomplete prize.",
        details: { prizeId: prize.id, prizeIndex: prize.index, confirmedCount },
      });
    }
  }
}

function validatePhaseSpecificInvariants(state: EventState, errors: InvariantError[]): void {
  const pendingAttempts = state.attempts.filter((attempt) => attempt.status === "pending");
  const confirmedAttempts = state.attempts.filter((attempt) => attempt.status === "confirmed");
  const currentPrize = state.prizes.find((prize) => prize.index === state.currentPrizeIndex);

  if (state.phase === "prizeComplete") {
    if (pendingAttempts.length > 0) {
      errors.push({
        code: "PRIZE_COMPLETE_PENDING_ATTEMPT_EXISTS",
        message: "Prize complete phase cannot contain a pending attempt.",
        details: { count: pendingAttempts.length },
      });
    }

    const currentPrizeConfirmedCount = currentPrize
      ? confirmedAttempts.filter((attempt) => attempt.prizeId === currentPrize.id).length
      : 0;
    if (currentPrizeConfirmedCount !== 1) {
      errors.push({
        code: "PRIZE_COMPLETE_CONFIRMED_ATTEMPT_COUNT",
        message: "Prize complete phase requires exactly one confirmed attempt for the current prize.",
        details: { currentPrizeIndex: state.currentPrizeIndex, confirmedCount: currentPrizeConfirmedCount },
      });
    }
  }

  if (state.phase === "eventComplete") {
    const confirmedWinnerCount = confirmedAttempts.length;
    if (confirmedWinnerCount !== REQUIRED_PRIZE_COUNT) {
      errors.push({
        code: "EVENT_COMPLETE_CONFIRMED_WINNER_COUNT",
        message: "Event complete requires exactly six confirmed prize winners.",
        details: { confirmedWinnerCount },
      });
    }

    if (pendingAttempts.length > 0) {
      errors.push({
        code: "EVENT_COMPLETE_PENDING_ATTEMPT_EXISTS",
        message: "Event complete cannot contain a pending attempt.",
        details: { count: pendingAttempts.length },
      });
    }

    const confirmedParticipantIds = confirmedAttempts.map((attempt) => attempt.participantId);
    const distinctConfirmedParticipantIds = new Set(confirmedParticipantIds);
    if (distinctConfirmedParticipantIds.size !== confirmedParticipantIds.length) {
      errors.push({
        code: "EVENT_COMPLETE_DUPLICATE_CONFIRMED_PARTICIPANT",
        message: "Event complete requires six distinct confirmed participant IDs.",
        details: {
          confirmedParticipantIds,
          distinctConfirmedParticipantCount: distinctConfirmedParticipantIds.size,
        },
      });
    }

    for (const prize of state.prizes) {
      const confirmedCount = confirmedAttempts.filter((attempt) => attempt.prizeId === prize.id).length;
      if (confirmedCount !== 1) {
        errors.push({
          code: "EVENT_COMPLETE_PRIZE_CONFIRMED_ATTEMPT_COUNT",
          message: "Event complete requires each prize to have exactly one confirmed attempt.",
          details: { prizeId: prize.id, prizeIndex: prize.index, confirmedCount },
        });
      }
    }
  }
}
