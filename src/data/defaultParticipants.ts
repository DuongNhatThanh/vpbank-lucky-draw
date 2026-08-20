import type { Participant } from "../domain/types";

export const DEFAULT_PARTICIPANTS: readonly Participant[] = createDefaultParticipants();

function createDefaultParticipants(): Participant[] {
  return Array.from({ length: 80 }, (_, index) => {
    const code = String(index + 1).padStart(4, "0");

    return {
      id: `participant-${code}`,
      code,
      status: "eligible",
    } satisfies Participant;
  });
}
