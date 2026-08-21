import { describe, expect, it, vi } from "vitest";
import { createPresentationAudioController, playPresentationSound } from "../../src/presentation/audio";

describe("presentation audio controller", () => {
  it("plays one-shot sounds and suppresses disabled playback", async () => {
    const created = createInspectableAudioFactory();
    const controller = createPresentationAudioController(created.factory);

    await expect(controller.playOneShot("digitStop", true)).resolves.toBe(true);
    expect(created.instances).toHaveLength(1);
    expect(created.instances[0]?.src).toBe("/audio/digit-stop.mp3");
    expect(created.instances[0]?.play).toHaveBeenCalledTimes(1);

    created.rejectNext = true;
    await expect(controller.playOneShot("winnerReveal", true)).resolves.toBe(false);
    expect(created.instances).toHaveLength(2);
    expect(created.instances[1]?.src).toBe("/audio/winner-reveal.mp3");
    expect(created.instances[1]?.play).toHaveBeenCalledTimes(1);

    await expect(playPresentationSound("countdownTick", false, created.factory)).resolves.toBe(false);
    expect(created.instances).toHaveLength(2);
  });

  it("replaces an active one-shot of the same sound instead of overlapping it", async () => {
    const created = createInspectableAudioFactory();
    const controller = createPresentationAudioController(created.factory);

    await expect(controller.playOneShot("countdownTick", true)).resolves.toBe(true);
    const first = created.instances[0];
    await expect(controller.playOneShot("countdownTick", true)).resolves.toBe(true);

    expect(created.instances).toHaveLength(2);
    expect(first?.pause).toHaveBeenCalledTimes(1);
    expect(first?.currentTime).toBe(0);
    expect(created.instances[1]?.play).toHaveBeenCalledTimes(1);
  });

  it("can stop an active one-shot sound without affecting disabled playback", async () => {
    const created = createInspectableAudioFactory();
    const controller = createPresentationAudioController(created.factory);

    await expect(controller.playOneShot("countdownTick", true)).resolves.toBe(true);
    controller.stopOneShot("countdownTick");

    expect(created.instances[0]?.pause).toHaveBeenCalledTimes(1);
    expect(created.instances[0]?.currentTime).toBe(0);
    expect(() => controller.stopOneShot("countdownTick")).not.toThrow();
  });

  it("keeps the reel spin loop single-instance and stops it safely", async () => {
    const created = createInspectableAudioFactory();
    const controller = createPresentationAudioController(created.factory);

    const firstLoop = controller.startLoop(true);
    const duplicateLoop = controller.startLoop(true);

    await expect(firstLoop).resolves.toBe(true);
    await expect(duplicateLoop).resolves.toBe(true);

    expect(created.instances).toHaveLength(1);
    expect(created.instances[0]?.src).toBe("/audio/reel-spin-loop.mp3");
    expect(created.instances[0]?.loop).toBe(true);
    expect(created.instances[0]?.play).toHaveBeenCalledTimes(1);

    controller.stopLoop();
    expect(created.instances[0]?.pause).toHaveBeenCalledTimes(1);
    expect(created.instances[0]?.currentTime).toBe(0);

    expect(() => controller.stopLoop()).not.toThrow();
    await expect(controller.startLoop(false)).resolves.toBe(false);
    expect(created.instances).toHaveLength(1);
  });
});

function createInspectableAudioFactory() {
  const instances: MockAudio[] = [];
  let rejectNext = false;

  const factory = vi.fn((src: string) => {
    const audio = createMockAudio(src, rejectNext);
    rejectNext = false;
    instances.push(audio);
    return audio as unknown as HTMLAudioElement;
  });

  return {
    instances,
    factory,
    get rejectNext() {
      return rejectNext;
    },
    set rejectNext(value: boolean) {
      rejectNext = value;
    },
  };
}

function createMockAudio(src: string, shouldReject: boolean) {
  return {
    src,
    play: shouldReject ? vi.fn().mockRejectedValue(new Error("blocked")) : vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    loop: false,
    volume: 1,
    currentTime: 0,
  } satisfies MockAudio;
}

type MockAudio = {
  src: string;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  loop: boolean;
  volume: number;
  currentTime: number;
};