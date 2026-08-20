import { transitionEventState } from "../../src/domain/eventMachine";
import { validateEventStateInvariants } from "../../src/domain/invariants";
import {
  clearEventState,
  inspectSavedSession,
  loadEventState,
  PERSISTENCE_KEY,
  saveEventState,
} from "../../src/services/persistence";
import type { EventState, Prize } from "../../src/domain/types";
import { MemoryStorage } from "../helpers/memoryStorage";

describe("persistence", () => {
  it("saves a valid state", () => {
    const storage = new MemoryStorage();
    const state = createEventState();
    const snapshot = structuredClone(state);

    const result = saveEventState(state, { storage, savedAt: "2026-08-19T10:00:00.000Z" });

    expect(result.ok).toBe(true);
    expect(storage.peek(PERSISTENCE_KEY)).not.toBeNull();
    if (result.ok) {
      expect(result.value.storageVersion).toBe(1);
      expect(result.value.savedAt).toBe("2026-08-19T10:00:00.000Z");
      expect(result.value.state).toEqual(state);
    }
    expect(state).toEqual(snapshot);
  });

  it("rejects invariant-invalid state on save", () => {
    const storage = new MemoryStorage();
    const state = createEventState({
      participants: [
        { id: "participant-0", code: "0000", status: "confirmed" },
        { id: "participant-1", code: "0001", status: "confirmed" },
      ],
      attempts: [
        { id: "attempt-0", prizeId: "prize-0", participantId: "participant-0", status: "confirmed", createdAt: "2026-08-19T10:00:00.000Z" },
        { id: "attempt-1", prizeId: "prize-1", participantId: "participant-0", status: "confirmed", createdAt: "2026-08-19T10:00:00.000Z" },
      ],
    });

    const result = saveEventState(state, { storage, savedAt: "2026-08-19T10:00:00.000Z" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PERSISTED_STATE_INVALID");
    }
    expect(storage.peek(PERSISTENCE_KEY)).toBeNull();
  });

  it("loads a valid ready state", () => {
    const storage = new MemoryStorage();
    const state = createEventState();
    storage.setItem(PERSISTENCE_KEY, JSON.stringify({ storageVersion: 1, savedAt: "2026-08-19T10:00:00.000Z", state }));

    const result = loadEventState({ storage });

    expect(result.ok).toBe(true);
    if (result.ok && result.status === "loaded") {
      expect(result.value).toEqual(state);
    }
  });

  it("rejects persisted participant code ABC", () => {
    const storage = new MemoryStorage();
    const state = createEventState({
      participants: [{ id: "participant-0", code: "ABC", status: "eligible" }],
    });
    storage.setItem(PERSISTENCE_KEY, JSON.stringify({ storageVersion: 1, savedAt: "2026-08-19T10:00:00.000Z", state }));

    const result = loadEventState({ storage });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PERSISTED_DATA_INVALID");
    }
  });

  it("rejects persisted participant code 27", () => {
    const storage = new MemoryStorage();
    const state = createEventState({
      participants: [{ id: "participant-0", code: "27", status: "eligible" }],
    });
    storage.setItem(PERSISTENCE_KEY, JSON.stringify({ storageVersion: 1, savedAt: "2026-08-19T10:00:00.000Z", state }));

    const result = loadEventState({ storage });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PERSISTED_DATA_INVALID");
    }
  });

  it("accepts persisted participant code 0027", () => {
    const storage = new MemoryStorage();
    const state = createEventState({
      participants: [{ id: "participant-0", code: "0027", status: "eligible" }],
    });
    storage.setItem(PERSISTENCE_KEY, JSON.stringify({ storageVersion: 1, savedAt: "2026-08-19T10:00:00.000Z", state }));

    const result = loadEventState({ storage });

    expect(result.ok).toBe(true);
    if (result.ok && result.status === "loaded") {
      expect(result.value.participants[0]?.code).toBe("0027");
    }
  });

  it("recovers a selected winner before animation finishes", () => {
    const storage = new MemoryStorage();
    const reelStoppingState = createReelStoppingState();
    storage.setItem(PERSISTENCE_KEY, JSON.stringify({ storageVersion: 1, savedAt: "2026-08-19T10:00:00.000Z", state: reelStoppingState }));

    const result = loadEventState({ storage });

    expect(result.ok).toBe(true);
    if (result.ok && result.status === "loaded") {
      expect(result.value).toEqual(reelStoppingState);
      expect(result.value.currentAttemptId).toBe("attempt-0");
      expect(result.value.participants.find((participant) => participant.id === "participant-0")?.status).toBe("pending");
      expect(result.value.attempts.at(0)).toEqual(reelStoppingState.attempts.at(0));
    }
  });

  it("recovers a pendingWinner state", () => {
    const storage = new MemoryStorage();
    const pendingWinnerState = createPendingWinnerState();
    storage.setItem(PERSISTENCE_KEY, JSON.stringify({ storageVersion: 1, savedAt: "2026-08-19T10:00:00.000Z", state: pendingWinnerState }));

    const result = loadEventState({ storage });

    expect(result.ok).toBe(true);
    if (result.ok && result.status === "loaded") {
      expect(result.value.currentAttemptId).toBe("attempt-0");
      expect(result.value.participants.find((participant) => participant.id === "participant-0")?.status).toBe("pending");
      expect(result.value.attempts.at(0)).toEqual(pendingWinnerState.attempts.at(0));
    }
  });

  it("preserves absent history", () => {
    const storage = new MemoryStorage();
    const absentState = createEventState({
      participants: [
        { id: "participant-0", code: "0000", status: "absent" },
        { id: "participant-1", code: "0001", status: "eligible" },
      ],
      attempts: [
        {
          id: "attempt-0",
          prizeId: "prize-0",
          participantId: "participant-0",
          status: "absent",
          createdAt: "2026-08-19T10:00:00.000Z",
          resolvedAt: "2026-08-19T10:05:00.000Z",
        },
      ],
    });
    storage.setItem(PERSISTENCE_KEY, JSON.stringify({ storageVersion: 1, savedAt: "2026-08-19T10:00:00.000Z", state: absentState }));

    const result = loadEventState({ storage });

    expect(result.ok).toBe(true);
    if (result.ok && result.status === "loaded") {
      expect(result.value.participants.find((participant) => participant.id === "participant-0")?.status).toBe("absent");
      expect(result.value.attempts.at(0)?.status).toBe("absent");
      expect(result.value.participants.filter((participant) => participant.status === "eligible")).toHaveLength(1);
    }
  });

  it("preserves confirmed progress", () => {
    const storage = new MemoryStorage();
    const confirmedState = createEventState({
      currentPrizeIndex: 1,
      configurationLocked: true,
      currentAttemptId: undefined,
      participants: [
        { id: "participant-0", code: "0000", status: "confirmed" },
        { id: "participant-1", code: "0001", status: "eligible" },
      ],
      attempts: [
        {
          id: "attempt-0",
          prizeId: "prize-0",
          participantId: "participant-0",
          status: "confirmed",
          createdAt: "2026-08-19T10:00:00.000Z",
          resolvedAt: "2026-08-19T10:05:00.000Z",
        },
      ],
    });
    storage.setItem(PERSISTENCE_KEY, JSON.stringify({ storageVersion: 1, savedAt: "2026-08-19T10:00:00.000Z", state: confirmedState }));

    const result = loadEventState({ storage });

    expect(result.ok).toBe(true);
    if (result.ok && result.status === "loaded") {
      expect(result.value.currentPrizeIndex).toBe(1);
      expect(result.value.configurationLocked).toBe(true);
      expect(result.value.attempts).toEqual(confirmedState.attempts);
    }
  });

  it("rejects a confirmed participant without a confirmed attempt", () => {
    const storage = new MemoryStorage();
    const state = createEventState({
      participants: [{ id: "participant-0", code: "0000", status: "confirmed" }],
      attempts: [],
    });
    storage.setItem(PERSISTENCE_KEY, JSON.stringify({ storageVersion: 1, savedAt: "2026-08-19T10:00:00.000Z", state }));

    const result = loadEventState({ storage });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PERSISTED_STATE_INVALID");
    }
  });

  it("rejects an absent participant without an absent attempt", () => {
    const storage = new MemoryStorage();
    const state = createEventState({
      participants: [{ id: "participant-0", code: "0000", status: "absent" }],
      attempts: [],
    });
    storage.setItem(PERSISTENCE_KEY, JSON.stringify({ storageVersion: 1, savedAt: "2026-08-19T10:00:00.000Z", state }));

    const result = loadEventState({ storage });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PERSISTED_STATE_INVALID");
    }
  });

  it("returns empty when there is no saved data", () => {
    const storage = new MemoryStorage();

    const result = loadEventState({ storage });

    expect(result).toEqual({ ok: true, status: "empty" });
  });

  it("rejects malformed JSON", () => {
    const storage = new MemoryStorage();
    storage.setItem(PERSISTENCE_KEY, "{not valid json");

    const result = loadEventState({ storage });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PERSISTED_DATA_INVALID");
    }
  });

  it("rejects wrong storageVersion", () => {
    const storage = new MemoryStorage();
    storage.setItem(PERSISTENCE_KEY, JSON.stringify({ storageVersion: 2, savedAt: "2026-08-19T10:00:00.000Z", state: createEventState() }));

    const result = loadEventState({ storage });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PERSISTED_DATA_VERSION_UNSUPPORTED");
    }
  });

  it("rejects wrong schemaVersion", () => {
    const storage = new MemoryStorage();
    const state = createEventState({ schemaVersion: 2 });
    storage.setItem(PERSISTENCE_KEY, JSON.stringify({ storageVersion: 1, savedAt: "2026-08-19T10:00:00.000Z", state }));

    const result = loadEventState({ storage });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PERSISTED_DATA_VERSION_UNSUPPORTED");
    }
  });

  it("rejects structurally invalid EventState", () => {
    const storage = new MemoryStorage();
    storage.setItem(PERSISTENCE_KEY, JSON.stringify({ storageVersion: 1, savedAt: "2026-08-19T10:00:00.000Z", state: { phase: "ready" } }));

    const result = loadEventState({ storage });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PERSISTED_DATA_INVALID");
    }
  });

  it("rejects invariant-invalid persisted state", () => {
    const storage = new MemoryStorage();
    const state = createInvariantInvalidState();
    storage.setItem(PERSISTENCE_KEY, JSON.stringify({ storageVersion: 1, savedAt: "2026-08-19T10:00:00.000Z", state }));

    const result = loadEventState({ storage });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PERSISTED_STATE_INVALID");
    }
  });

  it("handles storage exceptions", () => {
    const readStorage = new MemoryStorage({ getItem: new Error("boom") });
    const writeStorage = new MemoryStorage({ setItem: new Error("boom") });
    const clearStorage = new MemoryStorage({ removeItem: new Error("boom") });

    const loadResult = loadEventState({ storage: readStorage });
    expect(loadResult.ok).toBe(false);
    if (!loadResult.ok) {
      expect(loadResult.error.code).toBe("PERSISTENCE_READ_FAILED");
    }

    const saveResult = saveEventState(createEventState(), { storage: writeStorage, savedAt: "2026-08-19T10:00:00.000Z" });
    expect(saveResult.ok).toBe(false);
    if (!saveResult.ok) {
      expect(saveResult.error.code).toBe("PERSISTENCE_WRITE_FAILED");
    }

    const clearResult = clearEventState({ storage: clearStorage });
    expect(clearResult.ok).toBe(false);
    if (!clearResult.ok) {
      expect(clearResult.error.code).toBe("PERSISTENCE_CLEAR_FAILED");
    }
  });

  it("clears only the canonical key", () => {
    const storage = new MemoryStorage();
    storage.setItem("other-key", "keep");
    storage.setItem(PERSISTENCE_KEY, JSON.stringify({ storageVersion: 1, savedAt: "2026-08-19T10:00:00.000Z", state: createEventState() }));

    const result = clearEventState({ storage });

    expect(result.ok).toBe(true);
    expect(storage.peek(PERSISTENCE_KEY)).toBeNull();
    expect(storage.peek("other-key")).toBe("keep");
  });

  it("reports completed sessions as not recoverable", () => {
    const storage = new MemoryStorage();
    const state = createCompletedState();
    storage.setItem(PERSISTENCE_KEY, JSON.stringify({ storageVersion: 1, savedAt: "2026-08-19T10:00:00.000Z", state }));

    const inspection = inspectSavedSession({ storage });

    expect(inspection).toEqual({ status: "none", reason: "completed" });
  });

  it("does not present a pristine setup state as an interrupted live session", () => {
    const storage = new MemoryStorage();
    const state = createEventState({ phase: "setup" });
    storage.setItem(PERSISTENCE_KEY, JSON.stringify({ storageVersion: 1, savedAt: "2026-08-19T10:00:00.000Z", state }));

    const inspection = inspectSavedSession({ storage });

    expect(inspection).toEqual({ status: "none", reason: "pristine_setup" });

    const loaded = loadEventState({ storage });
    expect(loaded.ok).toBe(true);
    if (loaded.ok && loaded.status === "loaded") {
      expect(loaded.value.phase).toBe("setup");
    }
  });

  it("reports locked in-progress sessions as recoverable", () => {
    const storage = new MemoryStorage();
    const state = createEventState({ configurationLocked: true });
    storage.setItem(PERSISTENCE_KEY, JSON.stringify({ storageVersion: 1, savedAt: "2026-08-19T10:00:00.000Z", state }));

    const inspection = inspectSavedSession({ storage });

    expect(inspection.status).toBe("recoverable");
    if (inspection.status === "recoverable") {
      expect(inspection.phase).toBe("ready");
      expect(inspection.currentPrizeIndex).toBe(0);
      expect(inspection.hasCurrentAttempt).toBe(false);
    }
  });

  it("supports the persist-before-animation recovery flow", () => {
    const storage = new MemoryStorage();
    let state = createReadyState();
    state = expectTransition(state, { type: "START_COUNTDOWN" });
    state = expectTransition(state, { type: "START_DRAW" });
    state = expectTransition(state, { type: "SELECT_WINNER", attemptId: "attempt-0", createdAt: "2026-08-19T10:00:00.000Z" }, deterministicDependencies());
    const selectedParticipantId = state.attempts.at(-1)?.participantId;
    expect(state.phase).toBe("reelStopping");

    const saveResult = saveEventState(state, { storage, savedAt: "2026-08-19T10:00:05.000Z" });
    expect(saveResult.ok).toBe(true);

    const reloaded = loadEventState({ storage });
    expect(reloaded.ok).toBe(true);
    if (reloaded.ok && reloaded.status === "loaded") {
      const continued = expectTransition(reloaded.value, { type: "FINISH_REEL_STOPPING" });
      const confirmed = expectTransition(continued, { type: "CONFIRM_WINNER", resolvedAt: "2026-08-19T10:01:00.000Z" });

      expect(confirmed.attempts.at(0)?.participantId).toBe(selectedParticipantId);
      expect(confirmed.attempts.filter((attempt) => attempt.status === "confirmed")).toHaveLength(1);
      expect(validateEventStateInvariants(confirmed).valid).toBe(true);
    }
  });
});

function expectTransition(state: EventState, command: { type: string; [key: string]: unknown }, dependencies?: { selectWinner?: Parameters<typeof transitionEventState>[2]["selectWinner"] }): EventState {
  const result = transitionEventState(state, command as never, dependencies);
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`Expected transition to succeed for ${command.type}`);
  }

  return result.value;
}

function deterministicDependencies() {
  return {
    selectWinner: (participants: readonly EventState["participants"]) => {
      const firstEligible = participants.find((participant) => participant.status === "eligible");
      if (!firstEligible) {
        return {
          ok: false,
          error: {
            code: "NO_ELIGIBLE_PARTICIPANTS",
            message: "No eligible participants are available for drawing.",
          },
        } as const;
      }

      return {
        ok: true,
        value: firstEligible,
      } as const;
    },
  };
}

function createEventState(overrides: Partial<EventState> = {}): EventState {
  return {
    schemaVersion: 1,
    eventName: "DPC Party H1.2026",
    phase: "ready",
    participants: [
      { id: "participant-0", code: "0000", status: "eligible" },
      { id: "participant-1", code: "0001", status: "eligible" },
    ],
    prizes: createPrizes(),
    currentPrizeIndex: 0,
    attempts: [],
    configurationLocked: false,
    soundEnabled: true,
    updatedAt: "2026-08-19T10:00:00.000Z",
    ...overrides,
  };
}

function createReadyState(): EventState {
  return createEventState();
}

function createReelStoppingState(): EventState {
  return {
    schemaVersion: 1,
    eventName: "DPC Party H1.2026",
    phase: "reelStopping",
    participants: [
      { id: "participant-0", code: "0000", status: "pending" },
      { id: "participant-1", code: "0001", status: "eligible" },
    ],
    prizes: createPrizes(),
    currentPrizeIndex: 0,
    currentAttemptId: "attempt-0",
    attempts: [
      { id: "attempt-0", prizeId: "prize-0", participantId: "participant-0", status: "pending", createdAt: "2026-08-19T10:00:00.000Z" },
    ],
    configurationLocked: true,
    soundEnabled: true,
    updatedAt: "2026-08-19T10:00:00.000Z",
  };
}

function createPendingWinnerState(): EventState {
  return {
    ...createReelStoppingState(),
    phase: "pendingWinner",
  };
}

function createCompletedState(): EventState {
  const participants = Array.from({ length: 6 }, (_, index) => ({
    id: `participant-${index}`,
    code: index.toString().padStart(4, "0"),
    status: "confirmed" as const,
  }));
  const prizes = createPrizes();

  return {
    schemaVersion: 1,
    eventName: "DPC Party H1.2026",
    phase: "eventComplete",
    participants,
    prizes,
    currentPrizeIndex: 5,
    attempts: prizes.map((prize, index) => ({
      id: `attempt-${index}`,
      prizeId: prize.id,
      participantId: `participant-${index}`,
      status: "confirmed" as const,
      createdAt: "2026-08-19T10:00:00.000Z",
      resolvedAt: "2026-08-19T10:01:00.000Z",
    })),
    configurationLocked: true,
    soundEnabled: true,
    updatedAt: "2026-08-19T10:00:00.000Z",
  };
}

function createInvariantInvalidState(): EventState {
  return {
    schemaVersion: 1,
    eventName: "DPC Party H1.2026",
    phase: "eventComplete",
    participants: [
      { id: "participant-0", code: "0000", status: "confirmed" },
      { id: "participant-1", code: "0001", status: "confirmed" },
    ],
    prizes: createPrizes(),
    currentPrizeIndex: 5,
    attempts: [
      { id: "attempt-0", prizeId: "prize-0", participantId: "participant-0", status: "confirmed", createdAt: "2026-08-19T10:00:00.000Z" },
      { id: "attempt-1", prizeId: "prize-1", participantId: "participant-0", status: "confirmed", createdAt: "2026-08-19T10:00:00.000Z" },
    ],
    configurationLocked: true,
    soundEnabled: true,
    updatedAt: "2026-08-19T10:00:00.000Z",
  };
}

function createPrizes(): Prize[] {
  return Array.from({ length: 6 }, (_, index) => ({
    id: `prize-${index}`,
    index,
    name: index === 5 ? "Grand Prize" : `Prize ${index + 1}`,
    isGrandPrize: index === 5,
  }));
}
