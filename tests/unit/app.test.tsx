import { fireEvent, render, screen, within } from "@testing-library/react";
import App from "../../src/App";
import { LiveOperator } from "../../src/components/operator/LiveOperator";
import { PrizeReview } from "../../src/components/operator/PrizeReview";
import { createInitialEventState } from "../../src/state/initialState";
import { PERSISTENCE_KEY } from "../../src/services/persistence";
import { MemoryStorage } from "../helpers/memoryStorage";
import type { EventState } from "../../src/domain/types";

const NOW = "2026-08-20T08:00:00.000Z";
const SAVED_AT = "2026-08-20T08:05:00.000Z";

describe("App", () => {
  it("boots the operator setup flow", () => {
    render(<App now={NOW} storage={new MemoryStorage()} />);

    expect(screen.getByRole("heading", { name: /operator setup/i })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /load default roster/i }));
    expect(screen.getByText(/80 valid ready/i)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /apply participants/i }));
    expect(screen.getByRole("button", { name: /continue to live draw/i })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /continue to live draw/i }));
    expect(screen.getByText(/ready to begin the live draw/i)).toBeVisible();
  });

  it("shows recovery controls for a saved pending session", () => {
    const storage = new MemoryStorage();
    const state = createRecoverableState();
    storage.setItem(PERSISTENCE_KEY, JSON.stringify({ storageVersion: 1, savedAt: SAVED_AT, state }));

    render(<App now={NOW} storage={storage} />);

    expect(screen.getByRole("button", { name: /resume previous session/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /start new session/i })).toBeVisible();
  });

  it("hides participant setup controls until a recoverable session is resolved", () => {
    const storage = new MemoryStorage();
    const state = createRecoverableState();
    storage.setItem(PERSISTENCE_KEY, JSON.stringify({ storageVersion: 1, savedAt: SAVED_AT, state }));

    render(<App now={NOW} storage={storage} />);

    expect(screen.getAllByRole("heading", { name: /previous session found/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /load default roster/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /six-prize review/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /resume previous session/i }));
    expect(screen.queryByRole("button", { name: /load default roster/i })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Prize 1$/i })).toBeVisible();
  });

  it("hides participant setup controls for invalid recovery", () => {
    const storage = new MemoryStorage();
    storage.setItem(PERSISTENCE_KEY, "{not-json");

    render(<App now={NOW} storage={storage} />);

    expect(screen.getByRole("heading", { name: /saved session needs attention/i })).toBeVisible();
    expect(screen.queryByText(/setup is ready for participant review/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /load default roster/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /six-prize review/i })).not.toBeInTheDocument();
  });

  it("opens and cancels Start New confirmation without clearing storage", () => {
    const storage = new MemoryStorage();
    storage.setItem(PERSISTENCE_KEY, JSON.stringify({ storageVersion: 1, savedAt: SAVED_AT, state: createRecoverableState() }));

    render(<App now={NOW} storage={storage} />);

    fireEvent.click(screen.getByRole("button", { name: /start new session/i }));
    const dialog = screen.getByRole("dialog", { name: /start a new session/i });
    expect(dialog).toBeVisible();

    fireEvent.click(within(dialog).getByRole("button", { name: /cancel/i }));

    expect(screen.queryByRole("dialog", { name: /start a new session/i })).not.toBeInTheDocument();
    expect(storage.peek(PERSISTENCE_KEY)).not.toBeNull();
  });

  it("shows invalid participant preview count and keeps Apply disabled", () => {
    render(<App now={NOW} storage={new MemoryStorage()} />);

    fireEvent.change(screen.getByLabelText(/paste roster/i), { target: { value: "27" } });
    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));

    expect(getMetricValue("Invalid")).toBe("1");
    expect(screen.getByRole("button", { name: /apply participants/i })).toBeDisabled();
  });

  it("shows duplicate participant preview count and keeps Apply disabled", () => {
    render(<App now={NOW} storage={new MemoryStorage()} />);

    fireEvent.change(screen.getByLabelText(/paste roster/i), { target: { value: "0027\n0027" } });
    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));

    expect(getMetricValue("Duplicates")).toBe("2");
    expect(screen.getByRole("button", { name: /apply participants/i })).toBeDisabled();
  });

  it("renders the actual EventState phase in PrizeReview", () => {
    const event = {
      ...createInitialEventState(NOW),
      phase: "countdown" as const,
    };

    render(
      <PrizeReview
        prizes={event.prizes}
        currentPrizeIndex={event.currentPrizeIndex}
        phase={event.phase}
        appliedParticipantCount={event.participants.length}
        canPrepareLiveDraw={false}
        canStartLiveDraw={false}
        onPrepareLiveDraw={() => undefined}
      />,
    );

    expect(getDefinitionValue("Phase")).toHaveTextContent("Countdown");
  });

  it("does not display Setup as the phase after resuming a pending winner", () => {
    const storage = new MemoryStorage();
    storage.setItem(PERSISTENCE_KEY, JSON.stringify({ storageVersion: 1, savedAt: SAVED_AT, state: createRecoverableState() }));

    render(<App now={NOW} storage={storage} />);
    fireEvent.click(screen.getByRole("button", { name: /resume previous session/i }));

    expect(getDefinitionValue("Phase")).toHaveTextContent("Pending winner");
    expect(getDefinitionValue("Phase")).not.toHaveTextContent("Setup");
  });

  it("renders live operator actions for each phase", () => {
    const baseProps = createLiveOperatorProps();

    const { rerender } = render(<LiveOperator {...baseProps} phase="ready" primaryAction="startCountdown" />);
    expect(screen.getByRole("button", { name: /start draw/i })).toBeVisible();

    rerender(<LiveOperator {...baseProps} phase="countdown" primaryAction="startDraw" />);
    expect(screen.getByRole("button", { name: /complete countdown/i })).toBeVisible();

    rerender(<LiveOperator {...baseProps} phase="drawing" primaryAction="selectWinner" />);
    expect(screen.getByRole("button", { name: /select winner/i })).toBeVisible();

    rerender(
      <LiveOperator
        {...baseProps}
        phase="reelStopping"
        primaryAction="finishReveal"
        pendingWinner={{ id: "participant-0001", code: "0001", status: "pending" }}
      />,
    );
    expect(screen.getByRole("button", { name: /complete reveal/i })).toBeVisible();
    expect(screen.getByText("0001")).toBeVisible();

    rerender(
      <LiveOperator
        {...baseProps}
        phase="pendingWinner"
        primaryAction="confirmOrAbsent"
        pendingWinner={{ id: "participant-0001", code: "0001", status: "pending" }}
      />,
    );
    expect(screen.getByRole("button", { name: /confirm winner/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /mark absent/i })).toBeVisible();

    rerender(<LiveOperator {...baseProps} phase="prizeComplete" primaryAction="advancePrize" />);
    expect(screen.getByRole("button", { name: /next prize/i })).toBeVisible();

    rerender(<LiveOperator {...baseProps} phase="eventComplete" primaryAction="eventComplete" />);
    expect(screen.getByRole("heading", { name: /^Event complete$/i })).toBeVisible();
  });

  it("moves from setup into the live operator flow and advances the prize loop", () => {
    const storage = new MemoryStorage();
    render(
      <App
        now={NOW}
        storage={storage}
        createAttemptId={() => "attempt-0"}
        selectWinnerDependencies={firstEligibleDependencies()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /load default roster/i }));
    fireEvent.click(screen.getByRole("button", { name: /apply participants/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue to live draw/i }));

    expect(screen.getByRole("button", { name: /start draw/i })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /start draw/i }));
    expect(screen.getByRole("button", { name: /complete countdown/i })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /complete countdown/i }));
    expect(screen.getByRole("button", { name: /select winner/i })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /select winner/i }));
    expect(screen.getByRole("button", { name: /complete reveal/i })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /complete reveal/i }));
    expect(screen.getByRole("button", { name: /confirm winner/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /mark absent/i })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /confirm winner/i }));
    expect(screen.getByRole("button", { name: /next prize/i })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /next prize/i }));
    expect(screen.getByRole("button", { name: /start draw/i })).toBeVisible();
    expect(screen.getByRole("heading", { name: /^Prize 2$/i })).toBeVisible();
  });

  it("returns to the same prize after marking a winner absent", () => {
    const storage = new MemoryStorage();
    render(
      <App
        now={NOW}
        storage={storage}
        createAttemptId={() => "attempt-0"}
        selectWinnerDependencies={firstEligibleDependencies()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /load default roster/i }));
    fireEvent.click(screen.getByRole("button", { name: /apply participants/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue to live draw/i }));
    fireEvent.click(screen.getByRole("button", { name: /start draw/i }));
    fireEvent.click(screen.getByRole("button", { name: /complete countdown/i }));
    fireEvent.click(screen.getByRole("button", { name: /select winner/i }));
    fireEvent.click(screen.getByRole("button", { name: /complete reveal/i }));
    fireEvent.click(screen.getByRole("button", { name: /mark absent/i }));

    expect(screen.getByRole("button", { name: /start draw/i })).toBeVisible();
    expect(screen.getByRole("heading", { name: /^Prize 1$/i })).toBeVisible();
  });

  it("ignores a repeated Select Winner activation before the first commit renders", () => {
    const storage = new MemoryStorage();
    const attemptIds = ["attempt-0", "attempt-1"];
    let selectWinnerButton: HTMLElement | null = null;
    let reentered = false;
    let selectionCalls = 0;

    render(
      <App
        now={NOW}
        storage={storage}
        createAttemptId={() => attemptIds.shift() ?? "unexpected-attempt"}
        selectWinnerDependencies={{
          selectWinner: (participants) => {
            selectionCalls += 1;
            const selected = participants.find((participant) => participant.status === "eligible");
            if (!selected) {
              return {
                ok: false,
                error: {
                  code: "NO_ELIGIBLE_PARTICIPANTS",
                  message: "No eligible participants are available for drawing.",
                },
              };
            }

            return { ok: true, value: selected };
          },
        }}
        onBeforeLiveCommandCommit={(command) => {
          if (command === "selectWinner" && selectWinnerButton && !reentered) {
            reentered = true;
            fireEvent.click(selectWinnerButton);
          }
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /load default roster/i }));
    fireEvent.click(screen.getByRole("button", { name: /apply participants/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue to live draw/i }));
    fireEvent.click(screen.getByRole("button", { name: /start draw/i }));
    fireEvent.click(screen.getByRole("button", { name: /complete countdown/i }));

    selectWinnerButton = screen.getByRole("button", { name: /select winner/i });
    fireEvent.click(selectWinnerButton);

    expect(screen.getByRole("button", { name: /complete reveal/i })).toBeVisible();
    expect(screen.getByText("0001")).toBeVisible();
    expect(selectionCalls).toBe(1);

    const persistedState = readPersistedEventState(storage);
    expect(persistedState.attempts).toHaveLength(1);
    expect(persistedState.attempts.filter((attempt) => attempt.status === "pending")).toHaveLength(1);
    expect(persistedState.attempts[0]?.id).toBe("attempt-0");
    expect(persistedState.participants.filter((participant) => participant.status === "pending")).toHaveLength(1);
    expect(persistedState.participants.find((participant) => participant.status === "pending")?.code).toBe("0001");
    expect(storage.peek(PERSISTENCE_KEY)).not.toContain("attempt-1");
  });
});

function createRecoverableState() {
  const event = createInitialEventState(NOW);
  const pendingParticipant = { ...event.participants[0]!, status: "pending" as const };

  return {
    ...event,
    phase: "pendingWinner" as const,
    participants: [pendingParticipant, ...event.participants.slice(1)],
    currentAttemptId: "attempt-0",
    attempts: [
      {
        id: "attempt-0",
        prizeId: event.prizes[0]!.id,
        participantId: pendingParticipant.id,
        status: "pending" as const,
        createdAt: NOW,
      },
    ],
    configurationLocked: true,
    currentPrizeIndex: 0,
    updatedAt: NOW,
  };
}

function getMetricValue(label: string): string {
  const metric = screen.getByText(label).closest(".metric");
  if (!metric) {
    throw new Error(`Metric "${label}" was not found.`);
  }

  return within(metric).getByText(/\d+/).textContent ?? "";
}

function getDefinitionValue(label: string): HTMLElement {
  const labelElement = screen.getByText(label);
  const container = labelElement.parentElement;
  if (!container) {
    throw new Error(`Definition value "${label}" was not found.`);
  }

  const value = container.querySelector("strong, dd");
  if (!(value instanceof HTMLElement)) {
    throw new Error(`Definition value "${label}" did not have a readable value.`);
  }

  return value;
}

function createLiveOperatorProps() {
  const event = createInitialEventState(NOW);
  const currentPrize = event.prizes[0];

  return {
    phase: "ready" as const,
    currentPrize,
    progress: { current: 1, total: 6, label: "1/6" },
    eligibleCount: 80,
    confirmedCount: 0,
    absentCount: 0,
    attemptCount: 0,
    currentAttempt: undefined,
    pendingWinner: undefined,
    confirmedWinners: [],
    history: [],
    primaryAction: "startCountdown" as const,
    onStartCountdown: () => undefined,
    onStartDraw: () => undefined,
    onSelectWinner: () => undefined,
    onFinishReveal: () => undefined,
    onConfirmWinner: () => undefined,
    onMarkAbsent: () => undefined,
    onAdvancePrize: () => undefined,
  };
}

function firstEligibleDependencies(excludedCode?: string) {
  return {
    selectWinner: (participants: readonly { code: string; status: string }[]) => {
      const selected = participants.find((participant) => participant.status === "eligible" && participant.code !== excludedCode);
      if (!selected) {
        return {
          ok: false as const,
          error: {
            code: "NO_ELIGIBLE_PARTICIPANTS" as const,
            message: "No eligible participants are available for drawing.",
          },
        };
      }

      return { ok: true as const, value: selected };
    },
  };
}

function readPersistedEventState(storage: MemoryStorage): EventState {
  const raw = storage.peek(PERSISTENCE_KEY);
  if (!raw) {
    throw new Error("Expected persisted event state.");
  }

  return (JSON.parse(raw) as { state: EventState }).state;
}
