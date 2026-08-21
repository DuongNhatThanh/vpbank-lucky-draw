export type PresentationSound = "countdownTick" | "reelSpinLoop" | "digitStop" | "winnerReveal" | "grandPrize";
export type PresentationOneShotSound = Exclude<PresentationSound, "reelSpinLoop">;

export const PRESENTATION_AUDIO_ASSETS: Record<PresentationSound, string> = {
  countdownTick: "/audio/countdown-tick.mp3",
  reelSpinLoop: "/audio/reel-spin-loop.mp3",
  digitStop: "/audio/digit-stop.mp3",
  winnerReveal: "/audio/winner-reveal.mp3",
  grandPrize: "/audio/grand-prize.mp3",
};

type AudioFactory = (src: string) => HTMLAudioElement | null;

const defaultAudioFactory: AudioFactory = (src) => {
  if (typeof Audio === "undefined") {
    return null;
  }

  return new Audio(src);
};

export interface PresentationAudioController {
  playOneShot(sound: PresentationOneShotSound, enabled: boolean): Promise<boolean>;
  stopOneShot(sound: PresentationOneShotSound): void;
  startLoop(enabled: boolean): Promise<boolean>;
  stopLoop(): void;
}

export function createPresentationAudioController(audioFactory: AudioFactory = defaultAudioFactory): PresentationAudioController {
  let reelSpinLoopAudio: HTMLAudioElement | null = null;
  const activeOneShots = new Map<PresentationOneShotSound, HTMLAudioElement>();
  const stopLoop = () => {
    const audio = reelSpinLoopAudio;
    if (!audio) {
      return;
    }

    if (typeof audio.pause === "function") {
      audio.pause();
    }
    audio.currentTime = 0;
    reelSpinLoopAudio = null;
  };
  const stopOneShot = (sound: PresentationOneShotSound) => {
    const audio = activeOneShots.get(sound);
    if (!audio) {
      return;
    }

    if (typeof audio.pause === "function") {
      audio.pause();
    }
    audio.currentTime = 0;
    activeOneShots.delete(sound);
  };

  return {
    async playOneShot(sound, enabled) {
      if (!enabled) {
        return false;
      }

      // A sound key may only have one active instance. This prevents accidental
      // overlap if a UI effect is replayed before the previous clip finishes.
      stopOneShot(sound);

      const audio = audioFactory(PRESENTATION_AUDIO_ASSETS[sound]);
      if (!audio) {
        return false;
      }

      audio.volume = 0.35;
      activeOneShots.set(sound, audio);

      try {
        await audio.play();
        return true;
      } catch {
        if (activeOneShots.get(sound) === audio) {
          activeOneShots.delete(sound);
        }
        return false;
      }
    },
    stopOneShot,
    async startLoop(enabled) {
      if (!enabled) {
        stopLoop();
        return false;
      }

      if (reelSpinLoopAudio) {
        return true;
      }

      const audio = audioFactory(PRESENTATION_AUDIO_ASSETS.reelSpinLoop);
      if (!audio) {
        return false;
      }

      reelSpinLoopAudio = audio;
      audio.loop = true;
      audio.volume = 0.35;

      try {
        await audio.play();
        return true;
      } catch {
        if (reelSpinLoopAudio === audio) {
          stopLoop();
        }

        return false;
      }
    },
    stopLoop,
  };
}

export async function playPresentationSound(
  sound: PresentationOneShotSound,
  enabled: boolean,
  audioFactory: AudioFactory = defaultAudioFactory,
): Promise<boolean> {
  return createPresentationAudioController(audioFactory).playOneShot(sound, enabled);
}