import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PresentationStage } from "../../src/components/presentation/PresentationStage";
import { PRESENTATION_TIMING } from "../../src/presentation/timing";
import { playPresentationSound } from "../../src/presentation/audio";
import { createInitialEventState } from "../../src/state/initialState";
import type { AppState } from "../../src/state/actions";

const NOW = "2026-08-20T08:00:00.000Z";
const RESOLVED_AT = "2026-08-20T08:01:00.000Z";
const audioInstances: MockAudioInstance[] = [];

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: false });
  Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null, writable: true });
  delete (HTMLElement.prototype as HTMLElement & { requestFullscreen?: unknown }).requestFullscreen;
  delete (document as Document & { exitFullscreen?: unknown }).exitFullscreen;
});

beforeEach(() => {
  audioInstances.length = 0;
  vi.stubGlobal(
    "Audio",
    vi.fn((src: string) => {
      const audio = {
        src,
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
        loop: false,
        volume: 1,
        currentTime: 0,
      } satisfies MockAudioInstance;

      audioInstances.push(audio);
      return audio;
    }),
  );
});

describe("PresentationStage", () => {
  it("replays persisted code 0027 and completes the reveal exactly once", () => {
    vi.useFakeTimers();
    const onRevealComplete = vi.fn();
    const state = createReelStoppingState("0027");

    const { rerender } = render(
      <PresentationStage state={state} onReturnToOperator={() => undefined} onRevealComplete={onRevealComplete} />,
    );

    expect(screen.getByRole("heading", { name: /winning number/i })).toBeVisible();
    expect(screen.queryAllByTestId("presentation-digit")).toHaveLength(0);

    act(() => {
      vi.advanceTimersByTime(PRESENTATION_TIMING.reelDigitStopsMs[3] + 1);
      vi.runAllTimers();
    });

    expect(screen.getAllByTestId("presentation-digit").map((digit) => digit.textContent).join("")).toBe("0027");
    expect(onRevealComplete).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /complete reveal/i })).not.toBeInTheDocument();

    rerender(<PresentationStage state={state} onReturnToOperator={() => undefined} onRevealComplete={onRevealComplete} />);
    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(onRevealComplete).toHaveBeenCalledTimes(1);
  });

  it("uses reduced motion and still completes the same winner exactly once", () => {
    vi.useFakeTimers();
    installMatchMedia(true);
    const onRevealComplete = vi.fn();

    render(
      <PresentationStage
        state={createReelStoppingState("0027")}
        onReturnToOperator={() => undefined}
        onRevealComplete={onRevealComplete}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(PRESENTATION_TIMING.reducedMotionCompleteMs + 1);
      vi.runOnlyPendingTimers();
    });

    expect(screen.getAllByTestId("presentation-digit").map((digit) => digit.textContent).join("")).toBe("0027");
    expect(onRevealComplete).toHaveBeenCalledTimes(1);
  });

  it("shows a 3-2-1 countdown without completing a reveal", () => {
    vi.useFakeTimers();
    const onRevealComplete = vi.fn();
    const state = withPhase(createBaseState(), "countdown");

    render(<PresentationStage state={state} onReturnToOperator={() => undefined} onRevealComplete={onRevealComplete} />);

    expect(screen.getByTestId("presentation-countdown-value")).toHaveTextContent("3");

    act(() => {
      vi.advanceTimersByTime(PRESENTATION_TIMING.countdownStepMs);
    });
    expect(screen.getByTestId("presentation-countdown-value")).toHaveTextContent("2");

    act(() => {
      vi.advanceTimersByTime(PRESENTATION_TIMING.countdownStepMs);
    });
    expect(screen.getByTestId("presentation-countdown-value")).toHaveTextContent("1");
    expect(onRevealComplete).not.toHaveBeenCalled();
  });

  it("shows phase-appropriate live controls without exposing an official winner early", () => {
    const onRevealComplete = vi.fn();
    const ready = withPhase(createBaseState(), "ready");
    const { rerender } = render(
      <PresentationStage state={ready} onReturnToOperator={() => undefined} onRevealComplete={onRevealComplete} />,
    );

    expect(screen.queryByLabelText(/Winning code 0000/i)).not.toBeInTheDocument();
    expect(screen.queryByText("0000")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start draw/i })).toBeVisible();

    rerender(
      <PresentationStage
        state={withPhase(createBaseState(), "drawing")}
        onReturnToOperator={() => undefined}
        onRevealComplete={onRevealComplete}
      />,
    );

    expect(screen.getByRole("button", { name: /select winner/i })).toBeVisible();
    expect(screen.queryByLabelText(/^Winning code \d{4}$/i)).not.toBeInTheDocument();
  });

  it("shows the pending winner code and optional name", () => {
    const state = createPendingWinnerState("0027", "Nguyễn Văn A");

    render(<PresentationStage state={state} onReturnToOperator={() => undefined} onRevealComplete={() => undefined} />);

    expect(screen.getAllByTestId("presentation-digit").map((digit) => digit.textContent).join("")).toBe("0027");
    expect(screen.getByText("Nguyễn Văn A")).toBeVisible();
    expect(screen.getByRole("button", { name: /confirm winner/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /mark absent/i })).toBeVisible();
  });

  it("shows the confirmed winner for the current prize after confirmation", () => {
    const state = createPrizeCompleteState("0027");

    render(<PresentationStage state={state} onReturnToOperator={() => undefined} onRevealComplete={() => undefined} />);

    expect(screen.getAllByTestId("presentation-digit").map((digit) => digit.textContent).join("")).toBe("0027");
    expect(screen.queryByText("0000")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next prize/i })).toBeVisible();
  });

  it("uses Grand Prize treatment from isGrandPrize", () => {
    const state = createPendingWinnerState("0027");
    state.event.currentPrizeIndex = 5;
    state.event.attempts[0] = { ...state.event.attempts[0]!, prizeId: state.event.prizes[5]!.id };

    const { container } = render(
      <PresentationStage state={state} onReturnToOperator={() => undefined} onRevealComplete={() => undefined} />,
    );

    expect(container.querySelector(".presentation-prize--grand")).not.toBeNull();
    expect(container.querySelector(".winner-reveal--grand")).not.toBeNull();
  });

  it("renders all six confirmed winners at event completion", () => {
    const state = createEventCompleteState();

    render(<PresentationStage state={state} onReturnToOperator={() => undefined} onRevealComplete={() => undefined} />);

    expect(screen.getByText(/all six prizes have confirmed winners/i)).toBeVisible();
    expect(screen.getByLabelText("Confirmed winners").querySelectorAll("li")).toHaveLength(6);
  });

  it("requests and exits fullscreen when the browser supports it", async () => {
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null, writable: true });
    const requestFullscreen = vi.fn(async function (this: HTMLElement) {
      Object.defineProperty(document, "fullscreenElement", { configurable: true, value: this, writable: true });
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    const exitFullscreen = vi.fn(async () => {
      Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null, writable: true });
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", { configurable: true, value: requestFullscreen });
    Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exitFullscreen });

    render(<PresentationStage state={createPendingWinnerState("0027")} onReturnToOperator={() => undefined} onRevealComplete={() => undefined} />);

    const enterButton = await screen.findByRole("button", { name: /enter fullscreen/i });
    fireEvent.click(enterButton);
    await waitFor(() => expect(requestFullscreen).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: /exit fullscreen/i })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /exit fullscreen/i }));
    await waitFor(() => expect(exitFullscreen).toHaveBeenCalledTimes(1));
  });

  it("keeps working when fullscreen is denied", async () => {
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error("denied")),
    });

    render(<PresentationStage state={createPendingWinnerState("0027")} onReturnToOperator={() => undefined} onRevealComplete={() => undefined} />);

    fireEvent.click(await screen.findByRole("button", { name: /enter fullscreen/i }));
    expect(await screen.findByText(/presentation will continue normally/i)).toBeVisible();
    expect(screen.getAllByTestId("presentation-digit").map((digit) => digit.textContent).join("")).toBe("0027");
  });

  it("toggles presentation sound without changing the event state", () => {
    const state = createPendingWinnerState("0027");
    const before = JSON.stringify(state.event);
    render(<PresentationStage state={state} onReturnToOperator={() => undefined} onRevealComplete={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: /sound on/i }));

    expect(screen.getByRole("button", { name: /sound off/i })).toBeVisible();
    expect(JSON.stringify(state.event)).toBe(before);
  });

  it("plays enabled sounds and safely handles blocked playback", async () => {
    const play = vi.fn().mockResolvedValue(undefined);
    const audio = { play, volume: 1 } as unknown as HTMLAudioElement;
    const factory = vi.fn(() => audio);

    await expect(playPresentationSound("digitStop", true, factory)).resolves.toBe(true);
    expect(factory).toHaveBeenCalledWith("/audio/digit-stop.mp3");
    expect(play).toHaveBeenCalledTimes(1);

    const rejectedAudio = { play: vi.fn().mockRejectedValue(new Error("blocked")), volume: 1 } as unknown as HTMLAudioElement;
    await expect(playPresentationSound("winnerReveal", true, () => rejectedAudio)).resolves.toBe(false);
    await expect(playPresentationSound("countdownTick", false, factory)).resolves.toBe(false);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("plays the reel spin loop once, stops it after the fourth digit, and suppresses duplicate reveal sounds", () => {
    vi.useFakeTimers();
    const onRevealComplete = vi.fn();
    const state = createReelStoppingState("0027");

    const { rerender } = render(
      <PresentationStage state={withPhase(state, "drawing")} onReturnToOperator={() => undefined} onRevealComplete={onRevealComplete} />,
    );

    expect(audioInstances).toHaveLength(1);
    expect(audioInstances[0]?.src).toBe("/audio/reel-spin-loop.mp3");
    expect(audioInstances[0]?.play).toHaveBeenCalledTimes(1);

    rerender(<PresentationStage state={state} onReturnToOperator={() => undefined} onRevealComplete={onRevealComplete} />);

    act(() => {
      vi.advanceTimersByTime(PRESENTATION_TIMING.reelDigitStopsMs[0]);
    });
    expect(audioInstances.filter((audio) => audio.src === "/audio/digit-stop.mp3")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: /sound on/i }));

    act(() => {
      vi.advanceTimersByTime(PRESENTATION_TIMING.reelDigitStopsMs[1] - PRESENTATION_TIMING.reelDigitStopsMs[0]);
    });
    expect(audioInstances.filter((audio) => audio.src === "/audio/digit-stop.mp3")).toHaveLength(1);
    expect(audioInstances.filter((audio) => audio.src === "/audio/winner-reveal.mp3")).toHaveLength(0);

    act(() => {
      vi.advanceTimersByTime(PRESENTATION_TIMING.reelDigitStopsMs[3]);
      vi.runAllTimers();
    });

    expect(audioInstances.filter((audio) => audio.src === "/audio/reel-spin-loop.mp3")[0]?.pause).toHaveBeenCalledTimes(1);
    expect(audioInstances.filter((audio) => audio.src === "/audio/winner-reveal.mp3")).toHaveLength(0);
    expect(onRevealComplete).toHaveBeenCalledTimes(1);

    rerender(<PresentationStage state={state} onReturnToOperator={() => undefined} onRevealComplete={onRevealComplete} />);
    expect(audioInstances.filter((audio) => audio.src === "/audio/reel-spin-loop.mp3")).toHaveLength(1);
    expect(audioInstances.filter((audio) => audio.src === "/audio/winner-reveal.mp3")).toHaveLength(0);
  });

  it("plays the Grand Prize reveal sound once for the final prize", () => {
    vi.useFakeTimers();
    const onRevealComplete = vi.fn();
    const state = createGrandPrizeReelStoppingState("0027");

    render(<PresentationStage state={state} onReturnToOperator={() => undefined} onRevealComplete={onRevealComplete} />);

    act(() => {
      vi.advanceTimersByTime(PRESENTATION_TIMING.reelDigitStopsMs[3] + 1);
      vi.runAllTimers();
    });

    expect(audioInstances.filter((audio) => audio.src === "/audio/grand-prize.mp3")).toHaveLength(1);
    expect(audioInstances.filter((audio) => audio.src === "/audio/winner-reveal.mp3")).toHaveLength(0);
    expect(onRevealComplete).toHaveBeenCalledTimes(1);
  });

  it("shows bounded celebration for a confirmed prize and enhanced Grand Prize styling", () => {
    const state = createPrizeCompleteState("0027");
    const { container, rerender } = render(
      <PresentationStage state={state} onReturnToOperator={() => undefined} onRevealComplete={() => undefined} />,
    );

    expect(screen.getByTestId("confetti")).toBeVisible();

    state.event.currentPrizeIndex = 5;
    state.event.attempts[0] = { ...state.event.attempts[0]!, prizeId: state.event.prizes[5]!.id };
    rerender(<PresentationStage state={state} onReturnToOperator={() => undefined} onRevealComplete={() => undefined} />);

    expect(container.querySelector(".celebration-effect--grand")).not.toBeNull();
    expect(container.querySelector(".presentation-stage--grand")).not.toBeNull();
  });

  it("uses a static celebration under reduced motion", () => {
    installMatchMedia(true);
    render(<PresentationStage state={createPrizeCompleteState("0027")} onReturnToOperator={() => undefined} onRevealComplete={() => undefined} />);

    expect(screen.getByTestId("confetti-static")).toBeVisible();
    expect(screen.queryByTestId("confetti")).not.toBeInTheDocument();
  });
});

function createBaseState(): AppState {
  return {
    event: createInitialEventState(NOW),
    participantPreview: null,
    recovery: { status: "resumed" },
    error: null,
  };
}

function withPhase(state: AppState, phase: AppState["event"]["phase"]): AppState {
  return {
    ...state,
    event: {
      ...state.event,
      phase,
      configurationLocked: phase === "setup" ? false : true,
    },
  };
}

function createReelStoppingState(code: string): AppState {
  return createPendingAttemptState("reelStopping", code);
}

function createPendingWinnerState(code: string, name?: string): AppState {
  return createPendingAttemptState("pendingWinner", code, name);
}

function createPendingAttemptState(phase: "reelStopping" | "pendingWinner", code: string, name?: string): AppState {
  const state = createBaseState();
  const participantIndex = state.event.participants.findIndex((participant) => participant.code === code);
  if (participantIndex < 0) {
    throw new Error(`Participant ${code} not found in default roster.`);
  }

  const sourceParticipant = state.event.participants[participantIndex]!;
  const pendingParticipant = {
    ...sourceParticipant,
    ...(name ? { name } : {}),
    status: "pending" as const,
  };
  const participants = state.event.participants.map((participant, index) => (index === participantIndex ? pendingParticipant : participant));

  return {
    ...state,
    event: {
      ...state.event,
      phase,
      participants,
      currentAttemptId: "attempt-27",
      attempts: [
        {
          id: "attempt-27",
          prizeId: state.event.prizes[0]!.id,
          participantId: pendingParticipant.id,
          status: "pending",
          createdAt: NOW,
        },
      ],
      configurationLocked: true,
      updatedAt: NOW,
    },
  };
}

function createPrizeCompleteState(code: string): AppState {
  const state = createBaseState();
  const participantIndex = state.event.participants.findIndex((participant) => participant.code === code);
  if (participantIndex < 0) {
    throw new Error(`Participant ${code} not found in default roster.`);
  }

  const participant = { ...state.event.participants[participantIndex]!, status: "confirmed" as const };
  return {
    ...state,
    event: {
      ...state.event,
      phase: "prizeComplete",
      participants: state.event.participants.map((item, index) => (index === participantIndex ? participant : item)),
      attempts: [
        {
          id: "attempt-confirmed",
          prizeId: state.event.prizes[0]!.id,
          participantId: participant.id,
          status: "confirmed",
          createdAt: NOW,
          resolvedAt: RESOLVED_AT,
        },
      ],
      configurationLocked: true,
      updatedAt: RESOLVED_AT,
    },
  };
}

function createEventCompleteState(): AppState {
  const state = createBaseState();
  const selectedParticipants = state.event.participants.slice(0, 6).map((participant) => ({ ...participant, status: "confirmed" as const }));
  const participants = state.event.participants.map(
    (participant) => selectedParticipants.find((selected) => selected.id === participant.id) ?? participant,
  );

  return {
    ...state,
    event: {
      ...state.event,
      phase: "eventComplete",
      participants,
      currentPrizeIndex: 5,
      attempts: state.event.prizes.map((prize, index) => ({
        id: `attempt-${index}`,
        prizeId: prize.id,
        participantId: selectedParticipants[index]!.id,
        status: "confirmed" as const,
        createdAt: NOW,
        resolvedAt: RESOLVED_AT,
      })),
      configurationLocked: true,
      updatedAt: RESOLVED_AT,
    },
  };
}

function createGrandPrizeReelStoppingState(code: string): AppState {
  const state = createPendingAttemptState("reelStopping", code);
  return {
    ...state,
    event: {
      ...state.event,
      currentPrizeIndex: 5,
      attempts: state.event.attempts.map((attempt) => ({
        ...attempt,
        prizeId: state.event.prizes[5]!.id,
      })),
    },
  };
}

function installMatchMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation(() => ({
      matches,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

type MockAudioInstance = {
  src: string;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  loop: boolean;
  volume: number;
  currentTime: number;
};
