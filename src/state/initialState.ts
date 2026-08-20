import { DEFAULT_PARTICIPANTS } from "../data/defaultParticipants";
import type { EventState, Participant, Prize } from "../domain/types";
import type { AppState } from "./actions";

export const DEFAULT_EVENT_NAME = "DPC Party H1.2026";
export const DEFAULT_SOUND_ENABLED = true;

export interface CreateInitialEventStateOptions {
  participants?: readonly Participant[];
  prizes?: readonly Prize[];
  eventName?: string;
  soundEnabled?: boolean;
}

export function createCanonicalPrizes(): Prize[] {
  return [
    { id: "prize-0", index: 0, name: "Prize 1", isGrandPrize: false },
    { id: "prize-1", index: 1, name: "Prize 2", isGrandPrize: false },
    { id: "prize-2", index: 2, name: "Prize 3", isGrandPrize: false },
    { id: "prize-3", index: 3, name: "Prize 4", isGrandPrize: false },
    { id: "prize-4", index: 4, name: "Prize 5", isGrandPrize: false },
    { id: "prize-5", index: 5, name: "Grand Prize", isGrandPrize: true },
  ];
}

export function createInitialEventState(updatedAt: string, options: CreateInitialEventStateOptions = {}): EventState {
  const participantsSource = options.participants ?? DEFAULT_PARTICIPANTS;
  const prizesSource = options.prizes ?? createCanonicalPrizes();

  return {
    schemaVersion: 1,
    eventName: options.eventName ?? DEFAULT_EVENT_NAME,
    phase: "setup",
    participants: participantsSource.map((participant) => ({ ...participant })),
    prizes: prizesSource.map((prize) => ({ ...prize })),
    currentPrizeIndex: 0,
    attempts: [],
    configurationLocked: false,
    soundEnabled: options.soundEnabled ?? DEFAULT_SOUND_ENABLED,
    updatedAt,
  };
}

export function createInitialAppState(updatedAt: string): AppState {
  return {
    event: createInitialEventState(updatedAt),
    participantPreview: null,
    recovery: { status: "checking" },
    error: null,
  };
}

export function isSetupEventReadyForParticipantApply(event: EventState): boolean {
  return (
    event.phase === "setup" &&
    !event.configurationLocked &&
    event.currentPrizeIndex === 0 &&
    event.currentAttemptId === undefined &&
    event.attempts.length === 0
  );
}
