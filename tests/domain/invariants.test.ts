import { getEligibleParticipants } from "../../src/domain/eligibility";
import { selectWinnerFromParticipants } from "../../src/domain/drawEngine";
import { validateEventStateInvariants } from "../../src/domain/invariants";
import type { DrawAttempt, EventState, Participant, Prize } from "../../src/domain/types";

describe("invariants", () => {
  it("passes a valid six-prize state", () => {
    expect(validateEventStateInvariants(createState()).valid).toBe(true);
  });

  it("fails when fewer or more than six prizes exist", () => {
    expect(errorCodes(createState({ prizes: createPrizes().slice(0, 5) }))).toContain("INVALID_PRIZE_COUNT");
    expect(errorCodes(createState({ prizes: [...createPrizes(), createPrize(6)] }))).toContain("INVALID_PRIZE_COUNT");
  });

  it("fails duplicate prize indexes", () => {
    const prizes = createPrizes();
    prizes[1] = { ...prizes[1]!, index: 0 };

    expect(errorCodes(createState({ prizes }))).toContain("DUPLICATE_PRIZE_INDEX");
  });

  it("fails when more than one pending attempt exists", () => {
    const participants = createParticipants(3);
    participants[0] = { ...participants[0]!, status: "pending" };
    participants[1] = { ...participants[1]!, status: "pending" };
    const attempts: DrawAttempt[] = [
      createAttempt("attempt-1", "prize-0", "participant-0", "pending"),
      createAttempt("attempt-2", "prize-0", "participant-1", "pending"),
    ];

    expect(errorCodes(createState({ participants, attempts, currentAttemptId: "attempt-1" }))).toContain(
      "MULTIPLE_PENDING_ATTEMPTS",
    );
  });

  it("fails when pending participant and pending attempt do not agree", () => {
    const participants = createParticipants(3);
    participants[0] = { ...participants[0]!, status: "pending" };
    const attempts: DrawAttempt[] = [createAttempt("attempt-1", "prize-0", "participant-1", "pending")];

    expect(errorCodes(createState({ phase: "pendingWinner", participants, attempts, currentAttemptId: "attempt-1" }))).toContain(
      "PENDING_ATTEMPT_PARTICIPANT_MISMATCH",
    );
  });

  it("fails when an attempt references a missing participant", () => {
    const attempts: DrawAttempt[] = [createAttempt("attempt-1", "prize-0", "missing-participant", "confirmed")];

    expect(errorCodes(createState({ attempts }))).toContain("ATTEMPT_PARTICIPANT_NOT_FOUND");
  });

  it("fails when an attempt references a missing prize", () => {
    const participants = createParticipants(3);
    participants[0] = { ...participants[0]!, status: "confirmed" };
    const attempts: DrawAttempt[] = [createAttempt("attempt-1", "missing-prize", "participant-0", "confirmed")];

    expect(errorCodes(createState({ participants, attempts }))).toContain("ATTEMPT_PRIZE_NOT_FOUND");
  });

  it("fails when the same participant has confirmed attempts for more than one prize", () => {
    const participants = createParticipants(3);
    participants[0] = { ...participants[0]!, status: "confirmed" };
    const attempts: DrawAttempt[] = [
      createAttempt("attempt-1", "prize-0", "participant-0", "confirmed"),
      createAttempt("attempt-2", "prize-1", "participant-0", "confirmed"),
    ];

    expect(errorCodes(createState({ participants, attempts }))).toContain("PARTICIPANT_CONFIRMED_MULTIPLE_PRIZES");
  });

  it("fails when a confirmed attempt references a participant that is not confirmed", () => {
    const attempts: DrawAttempt[] = [createAttempt("attempt-1", "prize-0", "participant-0", "confirmed")];

    expect(errorCodes(createState({ attempts }))).toContain("CONFIRMED_ATTEMPT_PARTICIPANT_STATUS_MISMATCH");
  });

  it("fails when an absent attempt references a participant that is not absent", () => {
    const attempts: DrawAttempt[] = [createAttempt("attempt-1", "prize-0", "participant-0", "absent")];

    expect(errorCodes(createState({ attempts }))).toContain("ABSENT_ATTEMPT_PARTICIPANT_STATUS_MISMATCH");
  });

  it("fails when currentPrizeIndex is greater than five", () => {
    expect(errorCodes(createState({ currentPrizeIndex: 6 }))).toContain("CURRENT_PRIZE_INDEX_OUT_OF_RANGE");
  });

  it("fails eventComplete with fewer than six confirmed winners", () => {
    const completedState = createCompletedState(5);

    expect(errorCodes(completedState)).toContain("EVENT_COMPLETE_CONFIRMED_WINNER_COUNT");
  });

  it("passes eventComplete with exactly six confirmed winners", () => {
    expect(validateEventStateInvariants(createCompletedState(6)).valid).toBe(true);
  });

  it("fails when a completed prize has multiple confirmed attempts", () => {
    const participants = createParticipants(4);
    participants[0] = { ...participants[0]!, status: "confirmed" };
    participants[1] = { ...participants[1]!, status: "confirmed" };
    const attempts: DrawAttempt[] = [
      createAttempt("attempt-1", "prize-0", "participant-0", "confirmed"),
      createAttempt("attempt-2", "prize-0", "participant-1", "confirmed"),
    ];

    expect(errorCodes(createState({ participants, attempts }))).toContain("MULTIPLE_CONFIRMED_ATTEMPTS_FOR_PRIZE");
  });

  it("fails when the current prize advanced past an incomplete prize", () => {
    expect(errorCodes(createState({ currentPrizeIndex: 1 }))).toContain("ADVANCED_WITH_INCOMPLETE_PRIZE");
  });

  it("fails when a pending prize is no longer current", () => {
    const participants = createParticipants(3);
    participants[0] = { ...participants[0]!, status: "confirmed" };
    participants[1] = { ...participants[1]!, status: "pending" };
    const attempts: DrawAttempt[] = [
      createAttempt("attempt-1", "prize-0", "participant-0", "confirmed"),
      createAttempt("attempt-2", "prize-1", "participant-1", "pending"),
    ];

    expect(
      errorCodes(
        createState({
          phase: "pendingWinner",
          participants,
          attempts,
          currentAttemptId: "attempt-2",
          currentPrizeIndex: 2,
        }),
      ),
    ).toContain("PENDING_ATTEMPT_PRIZE_MISMATCH");
  });

  it("fails when pendingWinner phase has no pending attempt", () => {
    const participants = createParticipants(3);
    participants[0] = { ...participants[0]!, status: "pending" };

    expect(errorCodes(createState({ phase: "pendingWinner", participants }))).toContain(
      "PENDING_WINNER_PENDING_ATTEMPT_COUNT",
    );
  });

  it("fails when pendingWinner phase has no pending participant", () => {
    const attempts: DrawAttempt[] = [createAttempt("attempt-1", "prize-0", "participant-0", "pending")];

    expect(errorCodes(createState({ phase: "pendingWinner", attempts, currentAttemptId: "attempt-1" }))).toContain(
      "PENDING_WINNER_PENDING_PARTICIPANT_COUNT",
    );
  });

  it("fails when pendingWinner phase has no currentAttemptId", () => {
    const participants = createParticipants(3);
    participants[0] = { ...participants[0]!, status: "pending" };
    const attempts: DrawAttempt[] = [createAttempt("attempt-1", "prize-0", "participant-0", "pending")];

    expect(errorCodes(createState({ phase: "pendingWinner", participants, attempts }))).toContain(
      "PENDING_WINNER_CURRENT_ATTEMPT_MISMATCH",
    );
  });

  it("fails when pendingWinner currentAttemptId points to a non-pending attempt", () => {
    const participants = createParticipants(3);
    participants[0] = { ...participants[0]!, status: "confirmed" };
    participants[1] = { ...participants[1]!, status: "pending" };
    const attempts: DrawAttempt[] = [
      createAttempt("attempt-confirmed", "prize-0", "participant-0", "confirmed"),
      createAttempt("attempt-pending", "prize-1", "participant-1", "pending"),
    ];

    expect(
      errorCodes(
        createState({
          phase: "pendingWinner",
          participants,
          attempts,
          currentAttemptId: "attempt-confirmed",
          currentPrizeIndex: 1,
        }),
      ),
    ).toContain("PENDING_WINNER_CURRENT_ATTEMPT_MISMATCH");
  });

  it("passes when pendingWinner currentAttemptId matches the pending attempt", () => {
    const participants = createParticipants(3);
    participants[0] = { ...participants[0]!, status: "pending" };
    const attempts: DrawAttempt[] = [createAttempt("attempt-pending", "prize-0", "participant-0", "pending")];

    expect(
      validateEventStateInvariants(
        createState({
          phase: "pendingWinner",
          participants,
          attempts,
          currentAttemptId: "attempt-pending",
        }),
      ).valid,
    ).toBe(true);
  });

  it("fails when prizeComplete phase has a pending attempt", () => {
    const participants = createParticipants(3);
    participants[0] = { ...participants[0]!, status: "pending" };
    const attempts: DrawAttempt[] = [createAttempt("attempt-1", "prize-0", "participant-0", "pending")];

    expect(errorCodes(createState({ phase: "prizeComplete", participants, attempts, currentAttemptId: "attempt-1" }))).toContain(
      "PRIZE_COMPLETE_PENDING_ATTEMPT_EXISTS",
    );
  });

  it("fails when prizeComplete phase does not have exactly one confirmed attempt for the current prize", () => {
    expect(errorCodes(createState({ phase: "prizeComplete" }))).toContain("PRIZE_COMPLETE_CONFIRMED_ATTEMPT_COUNT");
  });

  it("fails when eventComplete does not give every prize exactly one confirmed attempt", () => {
    const participants = createParticipants(8);
    const attempts: DrawAttempt[] = [];

    for (let index = 0; index < 6; index += 1) {
      participants[index] = { ...participants[index]!, status: "confirmed" };
      const prizeId = index === 5 ? "prize-0" : `prize-${index}`;
      attempts.push(createAttempt(`attempt-${index}`, prizeId, `participant-${index}`, "confirmed"));
    }

    expect(errorCodes(createState({ phase: "eventComplete", participants, attempts, currentPrizeIndex: 5 }))).toContain(
      "EVENT_COMPLETE_PRIZE_CONFIRMED_ATTEMPT_COUNT",
    );
  });

  it("fails when eventComplete confirmed attempts do not reference distinct participants", () => {
    const participants = createParticipants(8);
    const attempts: DrawAttempt[] = [];

    for (let index = 0; index < 6; index += 1) {
      participants[index] = { ...participants[index]!, status: "confirmed" };
      const participantId = index === 5 ? "participant-0" : `participant-${index}`;
      attempts.push(createAttempt(`attempt-${index}`, `prize-${index}`, participantId, "confirmed"));
    }

    expect(errorCodes(createState({ phase: "eventComplete", participants, attempts, currentPrizeIndex: 5 }))).toContain(
      "EVENT_COMPLETE_DUPLICATE_CONFIRMED_PARTICIPANT",
    );
  });

  it("fails when eventComplete contains a pending attempt", () => {
    const state = createCompletedState(6);
    state.participants[6] = { ...state.participants[6]!, status: "pending" };
    state.attempts.push(createAttempt("attempt-pending", "prize-5", "participant-6", "pending"));

    expect(errorCodes(state)).toContain("EVENT_COMPLETE_PENDING_ATTEMPT_EXISTS");
  });

  it("simulates six confirmed prize winners from approximately eighty participants", () => {
    const participants = createParticipants(80);
    const confirmedWinnerIds = new Set<string>();
    const absentParticipantIds = new Set<string>();
    const attempts: DrawAttempt[] = [];
    let currentPrizeIndex = 0;
    let attemptIndex = 0;

    while (currentPrizeIndex < 6) {
      const eligibleBeforeDraw = getEligibleParticipants(participants).map((participant) => participant.id);
      const result = selectWinnerFromParticipants(participants);

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error("Expected a winner during invariant simulation.");
      }

      const selected = result.value;
      expect(eligibleBeforeDraw).toContain(selected.id);
      expect(confirmedWinnerIds.has(selected.id)).toBe(false);
      expect(absentParticipantIds.has(selected.id)).toBe(false);

      const shouldMarkAbsent = attemptIndex % 4 === 0;
      const attemptStatus = shouldMarkAbsent ? "absent" : "confirmed";
      attempts.push(createAttempt(`attempt-${attemptIndex}`, `prize-${currentPrizeIndex}`, selected.id, attemptStatus));

      const participantIndex = participants.findIndex((participant) => participant.id === selected.id);
      participants[participantIndex] = { ...participants[participantIndex]!, status: attemptStatus };

      if (shouldMarkAbsent) {
        absentParticipantIds.add(selected.id);
      } else {
        confirmedWinnerIds.add(selected.id);
        currentPrizeIndex += 1;
      }

      attemptIndex += 1;
    }

    const finalState = createState({
      phase: "eventComplete",
      participants,
      attempts,
      currentPrizeIndex: 5,
    });
    const confirmedAttemptParticipantIds = attempts
      .filter((attempt) => attempt.status === "confirmed")
      .map((attempt) => attempt.participantId);
    const absentIntersection = [...absentParticipantIds].filter((participantId) => confirmedWinnerIds.has(participantId));
    const confirmedAttemptsByPrizeId = new Map<string, number>();

    for (const attempt of attempts) {
      if (attempt.status === "confirmed") {
        confirmedAttemptsByPrizeId.set(attempt.prizeId, (confirmedAttemptsByPrizeId.get(attempt.prizeId) ?? 0) + 1);
      }
    }

    expect(confirmedWinnerIds.size).toBe(6);
    expect(new Set(confirmedAttemptParticipantIds).size).toBe(confirmedAttemptParticipantIds.length);
    expect(absentIntersection).toEqual([]);
    for (const prize of finalState.prizes) {
      expect(confirmedAttemptsByPrizeId.get(prize.id)).toBe(1);
    }
    expect(validateEventStateInvariants(finalState).valid).toBe(true);
  });
});

function errorCodes(state: EventState): string[] {
  return validateEventStateInvariants(state).errors.map((error) => error.code);
}

function createState(overrides: Partial<EventState> = {}): EventState {
  return {
    schemaVersion: 1,
    eventName: "DPC Party H1.2026",
    phase: "ready",
    participants: createParticipants(8),
    prizes: createPrizes(),
    currentPrizeIndex: 0,
    attempts: [],
    configurationLocked: false,
    soundEnabled: true,
    updatedAt: "2026-08-19T00:00:00.000Z",
    ...overrides,
  };
}

function createCompletedState(confirmedCount: number): EventState {
  const participants = createParticipants(8);
  const attempts: DrawAttempt[] = [];

  for (let index = 0; index < confirmedCount; index += 1) {
    participants[index] = { ...participants[index]!, status: "confirmed" };
    attempts.push(createAttempt(`attempt-${index}`, `prize-${index}`, `participant-${index}`, "confirmed"));
  }

  return createState({
    phase: "eventComplete",
    participants,
    attempts,
    currentPrizeIndex: 5,
  });
}

function createParticipants(count: number): Participant[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `participant-${index}`,
    code: index.toString().padStart(4, "0"),
    status: "eligible",
  }));
}

function createPrizes(): Prize[] {
  return Array.from({ length: 6 }, (_, index) => createPrize(index));
}

function createPrize(index: number): Prize {
  return {
    id: `prize-${index}`,
    index,
    name: index === 5 ? "Grand Prize" : `Prize ${index + 1}`,
    isGrandPrize: index === 5,
  };
}

function createAttempt(
  id: string,
  prizeId: string,
  participantId: string,
  status: DrawAttempt["status"],
): DrawAttempt {
  const resolvedAt = status === "pending" ? undefined : "2026-08-19T00:01:00.000Z";
  return {
    id,
    prizeId,
    participantId,
    status,
    createdAt: "2026-08-19T00:00:00.000Z",
    ...(resolvedAt ? { resolvedAt } : {}),
  };
}
