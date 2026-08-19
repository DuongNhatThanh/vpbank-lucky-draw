import { getEligibleParticipants } from "../../src/domain/eligibility";
import { secureRandomInteger, selectWinnerFromParticipants } from "../../src/domain/drawEngine";
import type { Participant } from "../../src/domain/types";

describe("drawEngine", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a safe error when there are zero eligible participants", () => {
    const participants: Participant[] = [
      { id: "participant-1", code: "0001", status: "confirmed" },
      { id: "participant-2", code: "0002", status: "absent" },
      { id: "participant-3", code: "0003", status: "pending" },
    ];

    const result = selectWinnerFromParticipants(participants);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NO_ELIGIBLE_PARTICIPANTS");
    }
  });

  it("always returns the only eligible participant", () => {
    const eligibleParticipant: Participant = { id: "participant-1", code: "0001", status: "eligible" };
    const participants: Participant[] = [
      eligibleParticipant,
      { id: "participant-2", code: "0002", status: "confirmed" },
    ];

    const result = selectWinnerFromParticipants(participants);

    expect(result).toEqual({ ok: true, value: eligibleParticipant });
  });

  it("returns a participant from the eligible pool", () => {
    mockUint32Sequence([1]);
    const participants: Participant[] = [
      { id: "participant-1", code: "0001", status: "eligible" },
      { id: "participant-2", code: "0002", status: "confirmed" },
      { id: "participant-3", code: "0003", status: "eligible" },
    ];

    const result = selectWinnerFromParticipants(participants);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(getEligibleParticipants(participants)).toContain(result.value);
      expect(result.value.id).toBe("participant-3");
    }
  });

  it("does not mutate the input participant array or statuses", () => {
    const participants: Participant[] = [
      { id: "participant-1", code: "0001", status: "eligible" },
      { id: "participant-2", code: "0002", status: "eligible" },
    ];
    const before = structuredClone(participants);

    selectWinnerFromParticipants(participants);

    expect(participants).toEqual(before);
  });

  it("does not use Math.random for official selection", () => {
    vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random must not be used for winner selection.");
    });
    const participants: Participant[] = [{ id: "participant-1", code: "0001", status: "eligible" }];

    expect(selectWinnerFromParticipants(participants).ok).toBe(true);
  });

  it("returns secure integers within the requested range", () => {
    for (let index = 0; index < 100; index += 1) {
      const result = secureRandomInteger(80);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeGreaterThanOrEqual(0);
        expect(result.value).toBeLessThan(80);
      }
    }
  });

  it("uses rejection sampling instead of modulo-biased selection", () => {
    mockUint32Sequence([4_294_967_295, 2]);

    const result = secureRandomInteger(3);

    expect(result).toEqual({ ok: true, value: 2 });
    expect(globalThis.crypto.getRandomValues).toHaveBeenCalledTimes(2);
  });
});

function mockUint32Sequence(values: number[]): void {
  let callIndex = 0;

  vi.spyOn(globalThis.crypto, "getRandomValues").mockImplementation((array) => {
    if (!(array instanceof Uint32Array)) {
      throw new Error("Expected Uint32Array for secure draw test.");
    }

    array[0] = values[Math.min(callIndex, values.length - 1)] ?? 0;
    callIndex += 1;
    return array;
  });
}
