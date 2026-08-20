import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PresentationStage } from "../../src/components/presentation/PresentationStage";
import { PRESENTATION_TIMING } from "../../src/presentation/timing";
import { createInitialEventState } from "../../src/state/initialState";
import type { AppState } from "../../src/state/actions";

const NOW = "2026-08-20T08:00:00.000Z";
const RESOLVED_AT = "2026-08-20T08:01:00.000Z";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("PresentationStage", () => {
  it("replays persisted code 0027 and completes the reveal exactly once", () => {
    vi.useFakeTimers();
    const onRevealComplete = vi.fn();
    const state = createReelStoppingState("0027");

    const { rerender } = render(
      <PresentationStage state={state} onReturnToOperator={() => undefined} onRevealComplete={onRevealComplete} />,
    );

    expect(screen.getByText(/winner selected and persisted/i)).toBeVisible();
    expect(screen.queryAllByTestId("presentation-digit")).toHaveLength(0);

    act(() => {
      vi.advanceTimersByTime(PRESENTATION_TIMING.reelDigitStopsMs[3] + 1);
      vi.runAllTimers();
    });

    expect(screen.getAllByTestId("presentation-digit").map((digit) => digit.textContent).join("")).toBe("0027");
    expect(onRevealComplete).toHaveBeenCalledTimes(1);

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

  it("does not expose an official winner in ready or drawing phases", () => {
    const onRevealComplete = vi.fn();
    const ready = withPhase(createBaseState(), "ready");
    const { rerender } = render(
      <PresentationStage state={ready} onReturnToOperator={() => undefined} onRevealComplete={onRevealComplete} />,
    );

    expect(screen.queryByLabelText(/Winning code 0000/i)).not.toBeInTheDocument();
    expect(screen.queryByText("0000")).not.toBeInTheDocument();

    rerender(
      <PresentationStage
        state={withPhase(createBaseState(), "drawing")}
        onReturnToOperator={() => undefined}
        onRevealComplete={onRevealComplete}
      />,
    );

    expect(screen.getByText(/official result is chosen by the draw engine/i)).toBeVisible();
    expect(screen.queryByLabelText(/^Winning code \d{4}$/i)).not.toBeInTheDocument();
  });

  it("shows the pending winner code and optional name", () => {
    const state = createPendingWinnerState("0027", "Nguyễn Văn A");

    render(<PresentationStage state={state} onReturnToOperator={() => undefined} onRevealComplete={() => undefined} />);

    expect(screen.getAllByTestId("presentation-digit").map((digit) => digit.textContent).join("")).toBe("0027");
    expect(screen.getByText("Nguyễn Văn A")).toBeVisible();
  });

  it("shows the confirmed winner for the current prize after confirmation", () => {
    const state = createPrizeCompleteState("0027");

    render(<PresentationStage state={state} onReturnToOperator={() => undefined} onRevealComplete={() => undefined} />);

    expect(screen.getAllByTestId("presentation-digit").map((digit) => digit.textContent).join("")).toBe("0027");
    expect(screen.queryByText("0000")).not.toBeInTheDocument();
    expect(screen.getByText(/prize winner confirmed/i)).toBeVisible();
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
