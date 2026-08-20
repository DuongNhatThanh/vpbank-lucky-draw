export type PresentationSound = "countdownTick" | "drawStart" | "revealComplete" | "winnerConfirmed" | "grandPrize";

export const PRESENTATION_AUDIO_ASSETS: Record<PresentationSound, string> = {
  countdownTick: "/audio/countdown-tick.mp3",
  drawStart: "/audio/draw-start.mp3",
  revealComplete: "/audio/reveal-complete.mp3",
  winnerConfirmed: "/audio/winner-confirmed.mp3",
  grandPrize: "/audio/grand-prize.mp3",
};

type AudioFactory = (src: string) => HTMLAudioElement | null;

const defaultAudioFactory: AudioFactory = (src) => {
  if (typeof Audio === "undefined") {
    return null;
  }

  return new Audio(src);
};

export async function playPresentationSound(
  sound: PresentationSound,
  enabled: boolean,
  audioFactory: AudioFactory = defaultAudioFactory,
): Promise<boolean> {
  if (!enabled) {
    return false;
  }

  const audio = audioFactory(PRESENTATION_AUDIO_ASSETS[sound]);
  if (!audio) {
    return false;
  }

  audio.volume = 0.35;

  try {
    await audio.play();
    return true;
  } catch {
    return false;
  }
}
