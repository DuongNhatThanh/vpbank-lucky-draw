import { fireEvent, render, screen, within } from "@testing-library/react";
import App from "../../src/App";
import { PrizeReview } from "../../src/components/operator/PrizeReview";
import { createInitialEventState } from "../../src/state/initialState";
import { PERSISTENCE_KEY } from "../../src/services/persistence";
import { MemoryStorage } from "../helpers/memoryStorage";

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
    expect(screen.getByRole("button", { name: /load default roster/i })).toBeVisible();
    expect(screen.getByRole("heading", { name: /six-prize review/i })).toBeVisible();
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
