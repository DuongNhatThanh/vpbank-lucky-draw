import type { EventState, Participant } from "./types";

export function isParticipantEligible(participant: Participant): boolean {
  return participant.status === "eligible";
}

export function getEligibleParticipants(source: EventState | readonly Participant[]): Participant[] {
  return getParticipants(source).filter(isParticipantEligible);
}

export function getConfirmedParticipants(source: EventState | readonly Participant[]): Participant[] {
  return getParticipants(source).filter((participant) => participant.status === "confirmed");
}

export function getAbsentParticipants(source: EventState | readonly Participant[]): Participant[] {
  return getParticipants(source).filter((participant) => participant.status === "absent");
}

export function getPendingParticipant(source: EventState | readonly Participant[]): Participant | undefined {
  return getParticipants(source).find((participant) => participant.status === "pending");
}

function getParticipants(source: EventState | readonly Participant[]): readonly Participant[] {
  return "participants" in source ? source.participants : source;
}
