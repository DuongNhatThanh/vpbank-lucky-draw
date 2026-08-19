import {
  getAbsentParticipants,
  getConfirmedParticipants,
  getEligibleParticipants,
  getPendingParticipant,
  isParticipantEligible,
} from "../../src/domain/eligibility";
import type { Participant } from "../../src/domain/types";

describe("eligibility", () => {
  const participants: Participant[] = [
    { id: "participant-1", code: "0001", status: "eligible" },
    { id: "participant-2", code: "0002", status: "confirmed" },
    { id: "participant-3", code: "0003", status: "absent" },
    { id: "participant-4", code: "0004", status: "pending" },
  ];

  it("returns eligible participants", () => {
    expect(getEligibleParticipants(participants)).toEqual([participants[0]]);
    expect(isParticipantEligible(participants[0]!)).toBe(true);
  });

  it("excludes confirmed participants", () => {
    expect(getEligibleParticipants(participants)).not.toContain(participants[1]);
    expect(getConfirmedParticipants(participants)).toEqual([participants[1]]);
  });

  it("excludes absent participants", () => {
    expect(getEligibleParticipants(participants)).not.toContain(participants[2]);
    expect(getAbsentParticipants(participants)).toEqual([participants[2]]);
  });

  it("excludes pending participants", () => {
    expect(getEligibleParticipants(participants)).not.toContain(participants[3]);
    expect(getPendingParticipant(participants)).toBe(participants[3]);
  });
});
