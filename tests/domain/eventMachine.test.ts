import { getAbsentParticipants, getEligibleParticipants } from "../../src/domain/eligibility";
import { validateEventStateInvariants } from "../../src/domain/invariants";
import {
  transitionEventState,
  type EventMachineCommand,
  type EventMachineDependencies,
} from "../../src/domain/eventMachine";
import type { EventState, Participant, Prize } from "../../src/domain/types";

describe("eventMachine", () => {
  it("runs the normal prize flow", () => {
    let state = createReadyState(12);
    expect(validateEventStateInvariants(state).valid).toBe(true);

    state = expectTransition(state, { type: "START_COUNTDOWN" });
    expect(state.phase).toBe("countdown");
    expect(state.configurationLocked).toBe(true);
    expect(validateEventStateInvariants(state).valid).toBe(true);

    state = expectTransition(state, { type: "START_DRAW" });
    expect(state.phase).toBe("drawing");
    expect(validateEventStateInvariants(state).valid).toBe(true);

    state = expectTransition(state, { type: "SELECT_WINNER", attemptId: "attempt-0", createdAt: "2026-08-19T10:00:00.000Z" }, deterministicDependencies());
    expect(state.phase).toBe("reelStopping");
    expect(state.currentAttemptId).toBe("attempt-0");
    expect(state.attempts).toHaveLength(1);
    expect(state.participants.filter((participant) => participant.status === "pending")).toHaveLength(1);
    expect(validateEventStateInvariants(state).valid).toBe(true);

    state = expectTransition(state, { type: "FINISH_REEL_STOPPING" });
    expect(state.phase).toBe("pendingWinner");
    expect(validateEventStateInvariants(state).valid).toBe(true);

    state = expectTransition(state, { type: "CONFIRM_WINNER", resolvedAt: "2026-08-19T10:01:00.000Z" });
    expect(state.phase).toBe("prizeComplete");
    expect(state.currentAttemptId).toBeUndefined();
    expect(validateEventStateInvariants(state).valid).toBe(true);

    state = expectTransition(state, { type: "ADVANCE_PRIZE" });
    expect(state.phase).toBe("ready");
    expect(state.currentPrizeIndex).toBe(1);
    expect(validateEventStateInvariants(state).valid).toBe(true);
  });

  it("supports absent and redraw for the same prize", () => {
    let state = createReadyState(12);
    state = runSingleDraw(state, "attempt-0", "2026-08-19T10:00:00.000Z");
    const firstWinnerId = state.attempts.at(-1)?.participantId;
    expect(firstWinnerId).toBeDefined();

    state = expectTransition(state, { type: "MARK_WINNER_ABSENT", resolvedAt: "2026-08-19T10:01:00.000Z" });
    expect(state.phase).toBe("ready");
    expect(state.currentPrizeIndex).toBe(0);
    expect(state.currentAttemptId).toBeUndefined();
    expect(getAbsentParticipants(state).map((participant) => participant.id)).toContain(firstWinnerId);
    expect(state.attempts).toHaveLength(1);
    expect(validateEventStateInvariants(state).valid).toBe(true);

    state = expectTransition(state, { type: "START_COUNTDOWN" });
    state = expectTransition(state, { type: "START_DRAW" });
    state = expectTransition(state, { type: "SELECT_WINNER", attemptId: "attempt-1", createdAt: "2026-08-19T10:02:00.000Z" }, deterministicDependencies());
    state = expectTransition(state, { type: "FINISH_REEL_STOPPING" });

    const redrawWinnerId = state.attempts.at(-1)?.participantId;
    expect(redrawWinnerId).toBeDefined();
    expect(redrawWinnerId).not.toBe(firstWinnerId);
    expect(getEligibleParticipants(state).map((participant) => participant.id)).not.toContain(firstWinnerId);
    expect(validateEventStateInvariants(state).valid).toBe(true);
  });

  it("simulates a full six-prize event with absent outcomes", () => {
    let state = createReadyState(80);
    const confirmedParticipantIds: string[] = [];
    const absentParticipantIds = new Set<string>();
    const dependencies = deterministicDependencies();
    let attemptIndex = 0;

    for (let prizeIndex = 0; prizeIndex < 6; prizeIndex += 1) {
      state = expectTransition(state, { type: "START_COUNTDOWN" });
      state = expectTransition(state, { type: "START_DRAW" });
      state = expectTransition(
        state,
        { type: "SELECT_WINNER", attemptId: `attempt-${attemptIndex}`, createdAt: `2026-08-19T10:${String(attemptIndex).padStart(2, "0")}:00.000Z` },
        dependencies,
      );
      const firstSelectedId = state.attempts.at(-1)?.participantId;
      state = expectTransition(state, { type: "FINISH_REEL_STOPPING" });

      if (prizeIndex % 2 === 0) {
        state = expectTransition(state, { type: "MARK_WINNER_ABSENT", resolvedAt: `2026-08-19T11:${String(attemptIndex).padStart(2, "0")}:00.000Z` });
        expect(firstSelectedId).toBeDefined();
        absentParticipantIds.add(firstSelectedId as string);
        expect(state.phase).toBe("ready");
        expect(state.currentPrizeIndex).toBe(prizeIndex);
        expect(state.currentAttemptId).toBeUndefined();
        expect(validateEventStateInvariants(state).valid).toBe(true);

        state = expectTransition(state, { type: "START_COUNTDOWN" });
        state = expectTransition(state, { type: "START_DRAW" });
        state = expectTransition(
          state,
          { type: "SELECT_WINNER", attemptId: `attempt-${attemptIndex + 1}`, createdAt: `2026-08-19T10:${String(attemptIndex + 1).padStart(2, "0")}:00.000Z` },
          dependencies,
        );
        state = expectTransition(state, { type: "FINISH_REEL_STOPPING" });
        attemptIndex += 1;
      }

      const confirmedCandidateId = state.attempts.at(-1)?.participantId;
      state = expectTransition(state, { type: "CONFIRM_WINNER", resolvedAt: `2026-08-19T12:${String(prizeIndex).padStart(2, "0")}:00.000Z` });
      if (confirmedCandidateId) {
        confirmedParticipantIds.push(confirmedCandidateId);
      }

      state = expectTransition(state, { type: "ADVANCE_PRIZE" });
      attemptIndex += 1;
      expect(state.currentPrizeIndex).toBeLessThanOrEqual(5);
    }

    const confirmedAttempts = state.attempts.filter((attempt) => attempt.status === "confirmed");
    const confirmedParticipantIdSet = new Set(confirmedAttempts.map((attempt) => attempt.participantId));
    const confirmedAttemptsByPrize = new Map<string, number>();

    for (const attempt of confirmedAttempts) {
      confirmedAttemptsByPrize.set(attempt.prizeId, (confirmedAttemptsByPrize.get(attempt.prizeId) ?? 0) + 1);
    }

    expect(state.phase).toBe("eventComplete");
    expect(confirmedAttempts).toHaveLength(6);
    expect(confirmedParticipantIdSet.size).toBe(6);
    expect(new Set(confirmedParticipantIds).size).toBe(6);
    expect([...absentParticipantIds].every((participantId) => !confirmedParticipantIdSet.has(participantId))).toBe(true);
    for (const prize of state.prizes) {
      expect(confirmedAttemptsByPrize.get(prize.id)).toBe(1);
    }
    expect(state.currentPrizeIndex).toBe(5);
    expect(validateEventStateInvariants(state).valid).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(transitionEventState(createReadyState(4), { type: "START_DRAW" }).ok).toBe(false);
    expect(transitionEventState(createReadyState(4), { type: "CONFIRM_WINNER", resolvedAt: "2026-08-19T10:00:00.000Z" }).ok).toBe(false);
    expect(transitionEventState(createReadyState(4), { type: "MARK_WINNER_ABSENT", resolvedAt: "2026-08-19T10:00:00.000Z" }).ok).toBe(false);
    expect(transitionEventState(createReadyState(4), { type: "ADVANCE_PRIZE" }).ok).toBe(false);

    const zeroEligibleState = createReadyState(4, {
      participants: createParticipants(4).map((participant, index) => ({
        ...participant,
        status: index % 2 === 0 ? "confirmed" : "absent",
      })),
    });
    expect(transitionEventState(zeroEligibleState, { type: "START_COUNTDOWN" }).ok).toBe(false);

    const invalidIncomingState = {
      ...createReadyState(4),
      prizes: createPrizes().slice(0, 5),
    } satisfies EventState;
    const invalidResult = transitionEventState(invalidIncomingState, { type: "START_COUNTDOWN" });
    expect(invalidResult.ok).toBe(false);
    if (!invalidResult.ok) {
      expect(invalidResult.error.code).toBe("INVALID_EVENT_STATE");
    }
  });

  it("keeps original state immutable across transitions", () => {
    const original = createReadyState(8);
    const snapshot = structuredClone(original);
    const countdown = expectTransition(original, { type: "START_COUNTDOWN" });
    const drawing = expectTransition(countdown, { type: "START_DRAW" });
    const selected = expectTransition(
      drawing,
      { type: "SELECT_WINNER", attemptId: "attempt-immutable", createdAt: "2026-08-19T10:00:00.000Z" },
      deterministicDependencies(),
    );

    expect(original).toEqual(snapshot);
    expect(original.participants).toEqual(snapshot.participants);
    expect(original.attempts).toEqual(snapshot.attempts);
    expect(selected.participants).not.toBe(original.participants);
    expect(selected.attempts).not.toBe(original.attempts);
  });

  it("only selects a winner during the drawing selection transition", () => {
    const selectWinnerSpy = vi.fn(deterministicDependencies().selectWinner);
    let state = createReadyState(6);

    state = expectTransition(state, { type: "START_COUNTDOWN" });
    state = expectTransition(state, { type: "START_DRAW" });

    const beforeSelectionAttempts = state.attempts.length;
    const drawingState = transitionEventState(state, { type: "SELECT_WINNER", attemptId: "attempt-0", createdAt: "2026-08-19T10:00:00.000Z" }, { selectWinner: selectWinnerSpy });

    expect(selectWinnerSpy).toHaveBeenCalledTimes(1);
    expect(state.attempts).toHaveLength(beforeSelectionAttempts);
    expect(drawingState.ok).toBe(true);
    if (drawingState.ok) {
      expect(drawingState.value.participants.filter((participant) => participant.status === "pending")).toHaveLength(1);
      expect(drawingState.value.attempts).toHaveLength(1);
    }

    const secondSelection = transitionEventState(
      drawingState.ok ? drawingState.value : state,
      { type: "SELECT_WINNER", attemptId: "attempt-1", createdAt: "2026-08-19T10:01:00.000Z" },
      { selectWinner: selectWinnerSpy },
    );
    expect(secondSelection.ok).toBe(false);
  });

  it("rejects empty resolvedAt for confirm and leaves state unchanged", () => {
    const original = buildPendingWinnerState();
    const snapshot = structuredClone(original);

    const result = transitionEventState(original, { type: "CONFIRM_WINNER", resolvedAt: "" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_COMMAND");
    }
    expect(original).toEqual(snapshot);
    expect(original.participants).toEqual(snapshot.participants);
    expect(original.attempts).toEqual(snapshot.attempts);
  });

  it("rejects empty resolvedAt for absent and leaves state unchanged", () => {
    const original = buildPendingWinnerState();
    const snapshot = structuredClone(original);

    const result = transitionEventState(original, { type: "MARK_WINNER_ABSENT", resolvedAt: "   " });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_COMMAND");
    }
    expect(original).toEqual(snapshot);
    expect(original.participants).toEqual(snapshot.participants);
    expect(original.attempts).toEqual(snapshot.attempts);
  });
});

function expectTransition(state: EventState, command: EventMachineCommand, dependencies?: EventMachineDependencies): EventState {
  const result = transitionEventState(state, command, dependencies);
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`Expected transition to succeed for ${command.type}`);
  }

  return result.value;
}

function runSingleDraw(state: EventState, attemptId: string, createdAt: string): EventState {
  const dependencies = deterministicDependencies();
  state = expectTransition(state, { type: "START_COUNTDOWN" });
  state = expectTransition(state, { type: "START_DRAW" });
  state = expectTransition(state, { type: "SELECT_WINNER", attemptId, createdAt }, dependencies);
  state = expectTransition(state, { type: "FINISH_REEL_STOPPING" });
  return state;
}

function deterministicDependencies(): EventMachineDependencies {
  return {
    selectWinner: (participants) => {
      const firstEligible = participants.find((participant) => participant.status === "eligible");
      if (!firstEligible) {
        return {
          ok: false,
          error: {
            code: "NO_ELIGIBLE_PARTICIPANTS",
            message: "No eligible participants are available for drawing.",
          },
        };
      }

      return { ok: true, value: firstEligible };
    },
  };
}

function createReadyState(participantCount: number, overrides: Partial<EventState> = {}): EventState {
  return {
    schemaVersion: 1,
    eventName: "DPC Party H1.2026",
    phase: "ready",
    participants: createParticipants(participantCount),
    prizes: createPrizes(),
    currentPrizeIndex: 0,
    attempts: [],
    configurationLocked: false,
    soundEnabled: true,
    updatedAt: "2026-08-19T09:00:00.000Z",
    ...overrides,
  };
}

function createParticipants(count: number): Participant[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `participant-${index}`,
    code: index.toString().padStart(4, "0"),
    status: "eligible" as const,
  }));
}

function createPrizes(): Prize[] {
  return Array.from({ length: 6 }, (_, index) => ({
    id: `prize-${index}`,
    index,
    name: index === 5 ? "Grand Prize" : `Prize ${index + 1}`,
    isGrandPrize: index === 5,
  }));
}

function buildPendingWinnerState(): EventState {
  return {
    schemaVersion: 1,
    eventName: "DPC Party H1.2026",
    phase: "pendingWinner",
    participants: [
      { id: "participant-0", code: "0000", status: "pending" },
      { id: "participant-1", code: "0001", status: "eligible" },
      { id: "participant-2", code: "0002", status: "eligible" },
    ],
    prizes: createPrizes(),
    currentPrizeIndex: 0,
    currentAttemptId: "attempt-0",
    attempts: [
      {
        id: "attempt-0",
        prizeId: "prize-0",
        participantId: "participant-0",
        status: "pending",
        createdAt: "2026-08-19T10:00:00.000Z",
      },
    ],
    configurationLocked: true,
    soundEnabled: true,
    updatedAt: "2026-08-19T10:00:00.000Z",
  };
}
