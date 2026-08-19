import { getEligibleParticipants } from "./eligibility";
import type { AppResult, DomainError, Participant } from "./types";

const UINT32_RANGE = 0x1_0000_0000;
const MAX_UINT32_RANGE = UINT32_RANGE;

export function secureRandomInteger(maxExclusive: number): AppResult<number> {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > MAX_UINT32_RANGE) {
    return {
      ok: false,
      error: {
        code: "INVALID_RANDOM_RANGE",
        message: "Secure random range must be an integer between 1 and 2^32.",
        details: { maxExclusive },
      },
    };
  }

  const randomSource = globalThis.crypto;
  if (!randomSource || typeof randomSource.getRandomValues !== "function") {
    return {
      ok: false,
      error: {
        code: "SECURE_RANDOM_UNAVAILABLE",
        message: "Web Crypto getRandomValues is required for official winner selection.",
      },
    };
  }

  const limit = Math.floor(UINT32_RANGE / maxExclusive) * maxExclusive;
  const buffer = new Uint32Array(1);

  let value = UINT32_RANGE;
  while (value >= limit) {
    randomSource.getRandomValues(buffer);
    value = buffer[0] ?? UINT32_RANGE;
  }

  return { ok: true, value: value % maxExclusive };
}

export function selectWinnerFromParticipants(participants: readonly Participant[]): AppResult<Participant> {
  const eligibleParticipants = getEligibleParticipants(participants);

  if (eligibleParticipants.length === 0) {
    return {
      ok: false,
      error: noEligibleParticipantsError(),
    };
  }

  const indexResult = secureRandomInteger(eligibleParticipants.length);
  if (!indexResult.ok) {
    return indexResult;
  }

  const selectedParticipant = eligibleParticipants[indexResult.value];
  if (!selectedParticipant) {
    return {
      ok: false,
      error: noEligibleParticipantsError(),
    };
  }

  return { ok: true, value: selectedParticipant };
}

function noEligibleParticipantsError(): DomainError {
  return {
    code: "NO_ELIGIBLE_PARTICIPANTS",
    message: "No eligible participants are available for drawing.",
  };
}
