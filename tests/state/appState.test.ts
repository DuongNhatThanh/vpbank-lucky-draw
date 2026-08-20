import { DEFAULT_PARTICIPANTS } from "../../src/data/defaultParticipants";
import { transitionEventState, type EventMachineCommand, type EventMachineDependencies } from "../../src/domain/eventMachine";
import { validateEventStateInvariants } from "../../src/domain/invariants";
import { previewParticipantsFromCsv, previewParticipantsFromPaste } from "../../src/services/participantImport";
import { loadEventState, PERSISTENCE_KEY, saveEventState } from "../../src/services/persistence";
import {
  applyParticipantsToAppState,
  clearApplicationError,
  clearParticipantPreview,
  initializeAppState,
  resumeSavedSession,
  setParticipantPreview,
  startNewSession,
} from "../../src/state/appController";
import { createInitialAppState, createInitialEventState } from "../../src/state/initialState";
import {
  selectAbsentParticipantCount,
  selectCanApplyParticipants,
  selectCanStartLiveDraw,
  selectConfirmedWinnerCount,
  selectCurrentPrize,
  selectEligibleParticipantCount,
  selectHasRecoverableSession,
  selectPendingParticipant,
} from "../../src/state/selectors";
import { MemoryStorage } from "../helpers/memoryStorage";

const NOW = "2026-08-20T08:00:00.000Z";
const SAVED_AT = "2026-08-20T08:05:00.000Z";

describe("state", () => {
  it("creates an initial app state with the default roster", () => {
    const snapshot = structuredClone(DEFAULT_PARTICIPANTS);
    const appState = createInitialAppState(NOW);

    expect(appState.event.phase).toBe("setup");
    expect(appState.event.participants).toHaveLength(80);
    expect(appState.event.participants.every((participant) => participant.status === "eligible")).toBe(true);
    expect(appState.event.prizes).toHaveLength(6);
    expect(appState.event.participants[0]?.code).toBe("0001");
    expect(appState.event.participants.at(-1)?.code).toBe("0080");
    expect(DEFAULT_PARTICIPANTS).toEqual(snapshot);
  });

  it("can set and clear participant preview without mutating the event", () => {
    const state = createInitialAppState(NOW);
    const snapshot = structuredClone(state.event);
    const preview = previewParticipantsFromPaste("0027\n0042");

    const withPreview = setParticipantPreview(state, preview);
    const cleared = clearParticipantPreview(withPreview);

    expect(state.event).toEqual(snapshot);
    expect(withPreview.participantPreview).toEqual(preview);
    expect(withPreview.event).toEqual(snapshot);
    expect(cleared.participantPreview).toBeNull();
    expect(cleared.event).toEqual(snapshot);
  });

  it("applies a valid participant list only after persistence succeeds", () => {
    const storage = new MemoryStorage();
    const baseState = initializeAppState({ storage, now: NOW });
    const preview = previewParticipantsFromCsv("code,name\r\n0027,Nguyễn Văn A\r\n0042,Trần Văn B");
    const stateWithPreview = setParticipantPreview(baseState, preview);

    const result = applyParticipantsToAppState(stateWithPreview, preview, { storage, savedAt: SAVED_AT });

    expect(result.ok).toBe(true);
    expect(storage.peek(PERSISTENCE_KEY)).not.toBeNull();
    expect(stateWithPreview.event).toEqual(baseState.event);
    if (result.ok) {
      expect(result.value.event.participants.map((participant) => participant.code)).toEqual(["0027", "0042"]);
      expect(result.value.participantPreview).toBeNull();
      expect(result.value.error).toBeNull();
      expect(loadEventState({ storage })).toEqual({ ok: true, status: "loaded", value: result.value.event });
    }
  });

  it("rejects invalid participant validation results", () => {
    const storage = new MemoryStorage();
    const state = initializeAppState({ storage, now: NOW });
    const preview = previewParticipantsFromCsv("0027,Nguyễn Văn A,extra");
    const stateWithPreview = setParticipantPreview(state, preview);
    const snapshot = structuredClone(stateWithPreview);

    const result = applyParticipantsToAppState(stateWithPreview, preview, { storage, savedAt: SAVED_AT });

    expect(result.ok).toBe(false);
    expect(stateWithPreview).toEqual(snapshot);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_COMMAND");
    }
  });

  it("rejects duplicate participant validation results", () => {
    const storage = new MemoryStorage();
    const state = initializeAppState({ storage, now: NOW });
    const preview = previewParticipantsFromCsv("0027\n0027");
    const stateWithPreview = setParticipantPreview(state, preview);
    const snapshot = structuredClone(stateWithPreview);

    const result = applyParticipantsToAppState(stateWithPreview, preview, { storage, savedAt: SAVED_AT });

    expect(result.ok).toBe(false);
    expect(stateWithPreview).toEqual(snapshot);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_COMMAND");
    }
  });

  it("rejects an empty preview", () => {
    const storage = new MemoryStorage();
    const state = initializeAppState({ storage, now: NOW });
    const preview = previewParticipantsFromPaste("");
    const stateWithPreview = setParticipantPreview(state, preview);
    const snapshot = structuredClone(stateWithPreview);

    const result = applyParticipantsToAppState(stateWithPreview, preview, { storage, savedAt: SAVED_AT });

    expect(result.ok).toBe(false);
    expect(stateWithPreview).toEqual(snapshot);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_COMMAND");
      expect(result.error.message).toBe("Participant preview must be valid before apply.");
    }
  });

  it("rejects locked setup state", () => {
    const storage = new MemoryStorage();
    const state = initializeAppState({ storage, now: NOW });
    const lockedState = {
      ...state,
      event: {
        ...state.event,
        configurationLocked: true,
      },
    };
    const preview = previewParticipantsFromPaste("0027");
    const stateWithPreview = setParticipantPreview(lockedState, preview);
    const snapshot = structuredClone(stateWithPreview);

    const result = applyParticipantsToAppState(stateWithPreview, preview, { storage, savedAt: SAVED_AT });

    expect(result.ok).toBe(false);
    expect(stateWithPreview).toEqual(snapshot);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_COMMAND");
    }
  });

  it("preserves the current app state when persistence fails during apply", () => {
    const storage = new MemoryStorage({ setItem: new Error("boom") });
    const state = initializeAppState({ storage, now: NOW });
    const preview = previewParticipantsFromPaste("0027");
    const stateWithPreview = setParticipantPreview(state, preview);
    const snapshot = structuredClone(stateWithPreview);

    const result = applyParticipantsToAppState(stateWithPreview, preview, { storage, savedAt: SAVED_AT });

    expect(result.ok).toBe(false);
    expect(stateWithPreview).toEqual(snapshot);
    expect(storage.peek(PERSISTENCE_KEY)).toBeNull();
    if (!result.ok) {
      expect(result.error.code).toBe("PERSISTENCE_WRITE_FAILED");
    }
  });

  it("initializes startup recovery state from saved session inspection", () => {
    const noDataState = initializeAppState({ storage: new MemoryStorage(), now: NOW });
    expect(noDataState.recovery).toEqual({ status: "noSession", reason: "no_saved_data" });
    expect(noDataState.event.phase).toBe("setup");

    const pristineStorage = new MemoryStorage();
    saveEventState(createInitialEventState(NOW), { storage: pristineStorage, savedAt: SAVED_AT });
    const pristineState = initializeAppState({ storage: pristineStorage, now: NOW });
    expect(pristineState.recovery).toEqual({ status: "noSession", reason: "pristine_setup" });

    const completedStorage = new MemoryStorage();
    completedStorage.setItem(
      PERSISTENCE_KEY,
      JSON.stringify({ storageVersion: 1, savedAt: SAVED_AT, state: createCompletedState() }),
    );
    const completedState = initializeAppState({ storage: completedStorage, now: NOW });
    expect(completedState.recovery).toEqual({ status: "noSession", reason: "completed" });

    const recoverableStorage = new MemoryStorage();
    recoverableStorage.setItem(
      PERSISTENCE_KEY,
      JSON.stringify({ storageVersion: 1, savedAt: SAVED_AT, state: createRecoverableState() }),
    );
    const recoverableState = initializeAppState({ storage: recoverableStorage, now: NOW });
    expect(recoverableState.recovery.status).toBe("recoverable");
    if (recoverableState.recovery.status === "recoverable") {
      expect(recoverableState.recovery.phase).toBe("pendingWinner");
      expect(recoverableState.recovery.hasCurrentAttempt).toBe(true);
    }

    const invalidStorage = new MemoryStorage();
    invalidStorage.setItem(
      PERSISTENCE_KEY,
      JSON.stringify({
        storageVersion: 1,
        savedAt: SAVED_AT,
        state: {
          ...createInitialEventState(NOW),
          prizes: createInitialEventState(NOW).prizes.slice(0, 5),
        },
      }),
    );
    const invalidState = initializeAppState({ storage: invalidStorage, now: NOW });
    expect(invalidState.recovery.status).toBe("invalid");
    expect(invalidState.error?.code).toBe("PERSISTED_STATE_INVALID");
  });

  it("resumes the exact pending winner without rerunning draw logic", () => {
    const storage = new MemoryStorage();
    const savedState = createRecoverableState();
    storage.setItem(PERSISTENCE_KEY, JSON.stringify({ storageVersion: 1, savedAt: SAVED_AT, state: savedState }));

    const startupState = initializeAppState({ storage, now: NOW });
    expect(startupState.recovery.status).toBe("recoverable");

    const result = resumeSavedSession(startupState, { storage });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.event).toEqual(savedState);
      expect(result.value.event.currentAttemptId).toBe("attempt-0");
      expect(result.value.event.attempts[0]).toEqual(savedState.attempts[0]);
      expect(result.value.event.participants.find((participant) => participant.status === "pending")?.id).toBe("participant-0001");
    }
  });

  it("starts a new session by clearing the canonical key and resetting app state", () => {
    const storage = new MemoryStorage();
    storage.setItem("other-key", "keep");
    storage.setItem(PERSISTENCE_KEY, JSON.stringify({ storageVersion: 1, savedAt: SAVED_AT, state: createRecoverableState() }));

    const currentState = {
      ...createInitialAppState(NOW),
      participantPreview: previewParticipantsFromPaste("0027"),
      error: { code: "PERSISTED_STATE_INVALID", message: "boom" },
      recovery: {
        status: "recoverable",
        savedAt: SAVED_AT,
        phase: "pendingWinner",
        currentPrizeIndex: 0,
        hasCurrentAttempt: true,
      } as const,
    };
    const result = startNewSession(currentState, { storage, now: NOW });

    expect(result.ok).toBe(true);
    expect(storage.peek(PERSISTENCE_KEY)).toBeNull();
    expect(storage.peek("other-key")).toBe("keep");
    if (result.ok) {
      expect(result.value.event).toEqual(createInitialEventState(NOW));
      expect(result.value.participantPreview).toBeNull();
      expect(result.value.error).toBeNull();
      expect(result.value.recovery).toEqual({ status: "noSession", reason: "no_saved_data" });
    }
  });

  it("keeps the current app state when clearing storage fails during start new", () => {
    const storage = new MemoryStorage({ removeItem: new Error("boom") });
    const currentState = createInitialAppState(NOW);
    const snapshot = structuredClone(currentState);

    const result = startNewSession(currentState, { storage, now: NOW });

    expect(result.ok).toBe(false);
    expect(currentState).toEqual(snapshot);
    if (!result.ok) {
      expect(result.error.code).toBe("PERSISTENCE_CLEAR_FAILED");
    }
  });

  it("exposes derived selectors for current prize and participant counts", () => {
    const state = createSelectorAppState();

    expect(selectCurrentPrize(state)?.index).toBe(1);
    expect(selectEligibleParticipantCount(state)).toBe(77);
    expect(selectConfirmedWinnerCount(state)).toBe(1);
    expect(selectAbsentParticipantCount(state)).toBe(1);
    expect(selectPendingParticipant(state)?.id).toBe("participant-0003");
  });

  it("allows the first ready draw when configuration is unlocked", () => {
    const state = {
      ...createInitialAppState(NOW),
      recovery: { status: "noSession" as const, reason: "no_saved_data" as const },
      event: {
        ...createInitialEventState(NOW),
        phase: "ready" as const,
      },
    };

    expect(selectCanStartLiveDraw(state)).toBe(true);
  });

  it("allows the next prize draw even when configurationLocked remains true", () => {
    const state = createNextPrizeReadyState();

    expect(state.event.phase).toBe("ready");
    expect(state.event.configurationLocked).toBe(true);
    expect(selectCanStartLiveDraw(state)).toBe(true);
  });

  it("blocks live draw when the state is not ready", () => {
    const state = createSelectorAppState();

    expect(selectCanStartLiveDraw(state)).toBe(false);
  });

  it("blocks live draw when no eligible participants remain", () => {
    const state = {
      ...createInitialAppState(NOW),
      event: {
        ...createInitialEventState(NOW),
        phase: "ready" as const,
        participants: createInitialEventState(NOW).participants.map((participant) => ({
          ...participant,
          status: "confirmed" as const,
        })),
      },
    };

    expect(selectCanStartLiveDraw(state)).toBe(false);
  });

  it("blocks live draw for invalid EventState", () => {
    const state = {
      ...createInitialAppState(NOW),
      event: {
        ...createInitialEventState(NOW),
        phase: "ready" as const,
        prizes: createInitialEventState(NOW).prizes.slice(0, 5),
      },
    };

    expect(selectCanStartLiveDraw(state)).toBe(false);
  });

  it("blocks application selection when the state is locked or unready", () => {
    const state = createSelectorAppState();

    expect(selectCanApplyParticipants(state)).toBe(false);
    expect(selectHasRecoverableSession({
      ...state,
      recovery: {
        status: "recoverable",
        savedAt: SAVED_AT,
        phase: "pendingWinner",
        currentPrizeIndex: 0,
        hasCurrentAttempt: true,
      },
    })).toBe(true);
  });

  it("keeps the current app state unchanged when preview is cleared or errors are cleared", () => {
    const state = {
      ...createInitialAppState(NOW),
      participantPreview: previewParticipantsFromPaste("0027"),
      error: { code: "PERSISTED_STATE_INVALID", message: "boom" },
    };

    const withoutPreview = clearParticipantPreview(state);
    const withoutError = clearApplicationError(state);

    expect(withoutPreview.participantPreview).toBeNull();
    expect(withoutPreview.event).toEqual(state.event);
    expect(withoutError.error).toBeNull();
    expect(withoutError.event).toEqual(state.event);
  });
});

function createSelectorAppState() {
  const event = createInitialEventState(NOW);
  const participants = event.participants.map((participant, index) => {
    if (index === 0) {
      return { ...participant, status: "confirmed" as const };
    }

    if (index === 1) {
      return { ...participant, status: "absent" as const };
    }

    if (index === 2) {
      return { ...participant, status: "pending" as const };
    }

    return participant;
  });

  const selectorEvent = {
    ...event,
    phase: "pendingWinner" as const,
    participants,
    currentPrizeIndex: 1,
    currentAttemptId: "attempt-2",
    configurationLocked: true,
    attempts: [
      {
        id: "attempt-0",
        prizeId: "prize-0",
        participantId: "participant-0001",
        status: "confirmed" as const,
        createdAt: NOW,
        resolvedAt: SAVED_AT,
      },
      {
        id: "attempt-1",
        prizeId: "prize-1",
        participantId: "participant-0002",
        status: "absent" as const,
        createdAt: NOW,
        resolvedAt: SAVED_AT,
      },
      {
        id: "attempt-2",
        prizeId: "prize-1",
        participantId: "participant-0003",
        status: "pending" as const,
        createdAt: NOW,
      },
    ],
  };

  expect(validateEventStateInvariants(selectorEvent).valid).toBe(true);

  return {
    ...createInitialAppState(NOW),
    event: selectorEvent,
    participantPreview: previewParticipantsFromPaste("0027"),
  };
}

function createNextPrizeReadyState() {
  let state = createInitialEventState(NOW);
  state = expectTransition(state, { type: "PREPARE_EVENT" });
  state = expectTransition(state, { type: "START_COUNTDOWN" });
  state = expectTransition(state, { type: "START_DRAW" });
  state = expectTransition(state, { type: "SELECT_WINNER", attemptId: "attempt-0", createdAt: NOW }, deterministicDependencies());
  state = expectTransition(state, { type: "FINISH_REEL_STOPPING" });
  state = expectTransition(state, { type: "CONFIRM_WINNER", resolvedAt: SAVED_AT });
  state = expectTransition(state, { type: "ADVANCE_PRIZE" });

  return {
    ...createInitialAppState(NOW),
    recovery: { status: "noSession", reason: "no_saved_data" },
    event: state,
  };
}

function createRecoverableState() {
  let state = createInitialEventState(NOW);
  state = expectTransition(state, { type: "PREPARE_EVENT" });
  state = expectTransition(state, { type: "START_COUNTDOWN" });
  state = expectTransition(state, { type: "START_DRAW" });
  state = expectTransition(state, { type: "SELECT_WINNER", attemptId: "attempt-0", createdAt: NOW }, deterministicDependencies());
  state = expectTransition(state, { type: "FINISH_REEL_STOPPING" });
  return state;
}

function expectTransition(state: ReturnType<typeof createInitialEventState>, command: EventMachineCommand, dependencies?: EventMachineDependencies) {
  const result = transitionEventState(state, command, dependencies);
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`Expected transition ${command.type} to succeed.`);
  }

  return result.value;
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

function createCompletedState() {
  const prizes = createInitialEventState(NOW).prizes;
  return {
    schemaVersion: 1,
    eventName: "DPC Party H1.2026",
    phase: "eventComplete" as const,
    participants: prizes.map((_, index) => ({
      id: `participant-${String(index + 1).padStart(4, "0")}`,
      code: String(index + 1).padStart(4, "0"),
      status: "confirmed" as const,
    })),
    prizes,
    currentPrizeIndex: 5,
    attempts: prizes.map((prize, index) => ({
      id: `attempt-${index}`,
      prizeId: prize.id,
      participantId: `participant-${String(index + 1).padStart(4, "0")}`,
      status: "confirmed" as const,
      createdAt: NOW,
      resolvedAt: SAVED_AT,
    })),
    configurationLocked: true,
    soundEnabled: true,
    updatedAt: NOW,
  };
}
