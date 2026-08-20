import { DEFAULT_PARTICIPANTS } from "../../src/data/defaultParticipants";
import { applyParticipantsToEventState, validateParticipantRows } from "../../src/domain/participantValidation";
import type { EventState } from "../../src/domain/types";

describe("participantValidation", () => {
  it("accepts 0027 and preserves it", () => {
    const result = validateParticipantRows([
      { sourceRow: 1, code: "0027", name: "Nguyễn Văn A" },
    ]);

    expect(result.received).toBe(1);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]?.code).toBe("0027");
    expect(result.valid[0]?.name).toBe("Nguyễn Văn A");
    expect(result.invalidRows).toHaveLength(0);
    expect(result.duplicateRows).toHaveLength(0);
  });

  it("rejects 27 and ABC", () => {
    const result = validateParticipantRows([
      { sourceRow: 1, code: "27" },
      { sourceRow: 2, code: "ABC" },
    ]);

    expect(result.received).toBe(2);
    expect(result.valid).toHaveLength(0);
    expect(result.invalidRows).toHaveLength(2);
  });

  it("trims optional names and blanks become undefined", () => {
    const result = validateParticipantRows([
      { sourceRow: 1, code: "0027", name: "  Nguyễn Văn A  " },
      { sourceRow: 2, code: "0042", name: "   " },
    ]);

    expect(result.valid).toHaveLength(2);
    expect(result.valid[0]?.name).toBe("Nguyễn Văn A");
    expect(result.valid[1]?.name).toBeUndefined();
  });

  it("detects duplicate codes and reports counts correctly", () => {
    const result = validateParticipantRows([
      { sourceRow: 1, code: "0027", name: "A" },
      { sourceRow: 2, code: "0027", name: "B" },
      { sourceRow: 3, code: "ABC" },
      { sourceRow: 4, code: "0042" },
    ]);

    expect(result.received).toBe(4);
    expect(result.valid).toHaveLength(1);
    expect(result.duplicateRows).toHaveLength(2);
    expect(result.invalidRows).toHaveLength(1);
    expect(result.duplicateRows.map((row) => row.sourceRow)).toEqual([1, 2]);
  });

  it("applies a valid participant list to a pristine setup state", () => {
    const inputState = createSetupState({
      participants: [
        { id: "participant-old", code: "9999", status: "pending" },
      ],
    });
    const snapshot = structuredClone(inputState);
    const validationResult = validateParticipantRows([
      { sourceRow: 1, code: "0027", name: "  Nguyễn Văn A  " },
      { sourceRow: 2, code: "0042" },
    ]);

    const result = applyParticipantsToEventState(inputState, validationResult);

    expect(result.ok).toBe(true);
    expect(inputState).toEqual(snapshot);
    if (result.ok) {
      expect(result.value.participants).toEqual([
        { id: "participant-0027", code: "0027", name: "Nguyễn Văn A", status: "eligible" },
        { id: "participant-0042", code: "0042", status: "eligible" },
      ]);
      expect(result.value.prizes).toEqual(snapshot.prizes);
    }
  });

  it("rejects invalid participant validation results", () => {
    const inputState = createSetupState();
    const validationResult = validateParticipantRows([{ sourceRow: 1, code: "27" }]);

    const result = applyParticipantsToEventState(inputState, validationResult);

    expect(result.ok).toBe(false);
    expect(inputState).toEqual(createSetupState());
  });

  it("rejects duplicate participant validation results", () => {
    const inputState = createSetupState();
    const validationResult = validateParticipantRows([
      { sourceRow: 1, code: "0027" },
      { sourceRow: 2, code: "0027" },
    ]);

    const result = applyParticipantsToEventState(inputState, validationResult);

    expect(result.ok).toBe(false);
    expect(inputState).toEqual(createSetupState());
  });

  it("rejects an empty roster without mutating the original state", () => {
    const inputState = createSetupState();
    const snapshot = structuredClone(inputState);
    const validationResult = validateParticipantRows([]);

    const result = applyParticipantsToEventState(inputState, validationResult);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_EVENT_STATE");
      expect(result.error.message).toBe("At least one valid participant is required before apply.");
    }
    expect(inputState).toEqual(snapshot);
  });

  it("rejects a candidate state that violates domain invariants", () => {
    const inputState = createSetupState({ prizes: createSetupState().prizes.slice(0, 5) });
    const snapshot = structuredClone(inputState);
    const validationResult = validateParticipantRows([{ sourceRow: 1, code: "0027" }]);

    const result = applyParticipantsToEventState(inputState, validationResult);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_EVENT_STATE");
      expect(result.error.details).toMatchObject({
        invariantErrors: [{ code: "INVALID_PRIZE_COUNT" }],
      });
    }
    expect(inputState).toEqual(snapshot);
  });

  it("rejects when configurationLocked is true", () => {
    const validationResult = validateParticipantRows([{ sourceRow: 1, code: "0027" }]);
    const result = applyParticipantsToEventState(createSetupState({ configurationLocked: true }), validationResult);

    expect(result.ok).toBe(false);
  });

  it("rejects state with live draw history", () => {
    const validationResult = validateParticipantRows([{ sourceRow: 1, code: "0027" }]);
    const result = applyParticipantsToEventState(
      createSetupState({
        currentPrizeIndex: 1,
        attempts: [
          {
            id: "attempt-1",
            prizeId: "prize-0",
            participantId: "participant-0001",
            status: "confirmed",
            createdAt: "2026-08-19T10:00:00.000Z",
            resolvedAt: "2026-08-19T10:01:00.000Z",
          },
        ],
      }),
      validationResult,
    );

    expect(result.ok).toBe(false);
  });

  it("validates the typed default roster and leaves it unchanged", () => {
    const snapshot = structuredClone(DEFAULT_PARTICIPANTS);
    const result = validateParticipantRows(
      DEFAULT_PARTICIPANTS.map((participant, index) => ({
        sourceRow: index + 1,
        code: participant.code,
        ...(participant.name !== undefined ? { name: participant.name } : {}),
      })),
    );

    expect(result.received).toBe(DEFAULT_PARTICIPANTS.length);
    expect(result.valid).toHaveLength(DEFAULT_PARTICIPANTS.length);
    expect(result.invalidRows).toHaveLength(0);
    expect(result.duplicateRows).toHaveLength(0);
    expect(DEFAULT_PARTICIPANTS).toEqual(snapshot);
  });
});

function createSetupState(overrides: Partial<EventState> = {}): EventState {
  return {
    schemaVersion: 1,
    eventName: "DPC Party H1.2026",
    phase: "setup",
    participants: [],
    prizes: [
      { id: "prize-0", index: 0, name: "Prize 1", isGrandPrize: false },
      { id: "prize-1", index: 1, name: "Prize 2", isGrandPrize: false },
      { id: "prize-2", index: 2, name: "Prize 3", isGrandPrize: false },
      { id: "prize-3", index: 3, name: "Prize 4", isGrandPrize: false },
      { id: "prize-4", index: 4, name: "Prize 5", isGrandPrize: false },
      { id: "prize-5", index: 5, name: "Grand Prize", isGrandPrize: true },
    ],
    currentPrizeIndex: 0,
    attempts: [],
    configurationLocked: false,
    soundEnabled: true,
    updatedAt: "2026-08-19T10:00:00.000Z",
    ...overrides,
  };
}
