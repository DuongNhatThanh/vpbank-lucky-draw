import { useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { PresentationStage } from "./components/presentation/PresentationStage";
import { DEFAULT_PARTICIPANTS } from "./data/defaultParticipants";
import type { EventMachineDependencies } from "./domain/eventMachine";
import type { AppResult } from "./domain/types";
import { previewParticipantsFromCsv, previewParticipantsFromPaste } from "./services/participantImport";
import type { StorageLike } from "./services/persistence";
import { LiveOperator } from "./components/operator/LiveOperator";
import { OperatorSetup } from "./components/operator/OperatorSetup";
import { StatusMessage } from "./components/shared/StatusMessage";
import type { AppState } from "./state/actions";
import {
  advanceLivePrize,
  applyParticipantsToAppState,
  clearApplicationError,
  clearParticipantPreview,
  confirmLiveWinner,
  finishLiveReveal,
  initializeAppState,
  markLiveWinnerAbsent,
  prepareEventForLiveDraw,
  resumeSavedSession,
  selectLiveWinner,
  setParticipantPreview,
  startLiveCountdown,
  startLiveDraw,
  startNewSession,
} from "./state/appController";
import {
  selectAbsentParticipantCount,
  selectCanApplyParticipants,
  selectCanPrepareLiveDraw,
  selectCanStartLiveDraw,
  selectConfirmedWinnerCount,
  selectConfirmedWinners,
  selectCurrentAttempt,
  selectCurrentPrize,
  selectEligibleParticipantCount,
  selectEventHistory,
  selectCurrentPendingWinner,
  selectPrimaryOperatorAction,
  selectPrizeProgress,
  selectPendingParticipant,
} from "./state/selectors";

export type LiveCommandName =
  | "startCountdown"
  | "startDraw"
  | "selectWinner"
  | "finishReveal"
  | "confirmWinner"
  | "markAbsent"
  | "advancePrize";

export interface AppProps {
  storage?: StorageLike;
  now?: string;
  createAttemptId?: () => string;
  selectWinnerDependencies?: EventMachineDependencies;
  onBeforeLiveCommandCommit?: (command: LiveCommandName) => void;
}

type ViewMode = "operator" | "presentation";

export default function App({ storage, now, createAttemptId, selectWinnerDependencies, onBeforeLiveCommandCommit }: AppProps) {
  const [bootTime] = useState(() => now ?? new Date().toISOString());
  const [state, setState] = useState<AppState>(() => initializeAppState({ now: bootTime, ...withStorage(storage) }));
  const [inputMode, setInputMode] = useState<"paste" | "csv">("paste");
  const [pasteValue, setPasteValue] = useState(() => serializeDefaultRoster(DEFAULT_PARTICIPANTS));
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [startNewConfirmationOpen, setStartNewConfirmationOpen] = useState(false);
  const [liveActionInFlight, setLiveActionInFlight] = useState<LiveCommandName | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("operator");
  const attemptCounterRef = useRef(0);
  const liveActionInFlightRef = useRef<LiveCommandName | null>(null);
  const revealCompletionAttemptRef = useRef<string | null>(null);
  const getTimestamp = () => now ?? new Date().toISOString();

  useEffect(() => {
    if (state.error && state.recovery.status !== "invalid") {
      document.title = `VPBank Lucky Draw - ${state.error.message}`;
    } else {
      document.title = "VPBank Lucky Draw";
    }
  }, [state.error, state.recovery.status]);

  useEffect(() => {
    if (liveActionInFlightRef.current) {
      liveActionInFlightRef.current = null;
      setLiveActionInFlight(null);
    }
  }, [state.event, state.error]);

  useEffect(() => {
    if (state.event.phase !== "reelStopping") {
      revealCompletionAttemptRef.current = null;
    }
  }, [state.event.currentAttemptId, state.event.phase]);

  const currentPrize = selectCurrentPrize(state);
  const currentAttempt = selectCurrentAttempt(state);
  const eligibleParticipantCount = selectEligibleParticipantCount(state);
  const confirmedWinnerCount = selectConfirmedWinnerCount(state);
  const absentParticipantCount = selectAbsentParticipantCount(state);
  const pendingParticipant = selectPendingParticipant(state);
  const pendingWinner = selectCurrentPendingWinner(state);
  const prizeProgress = selectPrizeProgress(state);
  const primaryOperatorAction = selectPrimaryOperatorAction(state);
  const eventHistory = selectEventHistory(state);
  const confirmedWinners = selectConfirmedWinners(state);
  const canApplyParticipants = selectCanApplyParticipants(state);
  const canPrepareLiveDraw = selectCanPrepareLiveDraw(state);
  const canStartLiveDraw = selectCanStartLiveDraw(state);
  const canShowNormalSetup = state.recovery.status === "noSession" || state.recovery.status === "resumed";
  const canShowLiveExperience = canShowNormalSetup && state.event.phase !== "setup";
  const shouldShowSetupConfiguration = canShowNormalSetup && state.event.phase === "setup";
  const shouldShowLiveOperator = canShowLiveExperience && viewMode === "operator";
  const shouldShowPresentation = canShowLiveExperience && viewMode === "presentation";
  const heroStatus = getHeroStatus(state, canStartLiveDraw);
  const pageTitle = state.event.phase === "setup" ? "Operator setup" : "Live operator";
  const pageLede =
    state.event.phase === "setup"
      ? "Prepare the participant roster, review six prizes, and move safely into the live draw flow."
      : "Run the next prize safely, then switch into the audience presentation whenever the room is ready.";

  useEffect(() => {
    if (!canShowLiveExperience && viewMode !== "operator") {
      setViewMode("operator");
    }
  }, [canShowLiveExperience, viewMode]);

  const summaryItems = useMemo(
    () => [
      { label: "Participants", value: state.event.participants.length },
      { label: "Eligible", value: eligibleParticipantCount },
      { label: "Confirmed", value: confirmedWinnerCount },
      { label: "Absent", value: absentParticipantCount },
      { label: "Pending", value: pendingParticipant ? 1 : 0 },
    ],
    [absentParticipantCount, confirmedWinnerCount, eligibleParticipantCount, pendingParticipant, state.event.participants.length],
  );

  function commit(nextStateResult: AppResult<AppState>) {
    if (nextStateResult.ok) {
      setState(nextStateResult.value);
      return;
    }

    setState((current) => ({
      ...current,
      error: nextStateResult.error,
    }));
  }

  function runLiveCommand(command: LiveCommandName, operation: () => AppResult<AppState>) {
    if (liveActionInFlightRef.current) {
      return;
    }

    liveActionInFlightRef.current = command;
    setLiveActionInFlight(command);

    try {
      const result = operation();
      onBeforeLiveCommandCommit?.(command);
      commit(result);
    } catch (error) {
      liveActionInFlightRef.current = null;
      setLiveActionInFlight(null);
      throw error;
    }
  }

  function handlePreviewPaste() {
    const preview = previewParticipantsFromPaste(pasteValue);
    setState((current) => setParticipantPreview(current, preview));
    setCsvFileName(null);
  }

  async function handleCsvFileSelected(file: File | null) {
    if (!file) {
      setCsvFileName(null);
      return;
    }

    setCsvFileName(file.name);
    setInputMode("csv");

    try {
      const text = await file.text();
      const preview = previewParticipantsFromCsv(text);
      setState((current) => setParticipantPreview(current, preview));
    } catch (error) {
      setState((current) => ({
        ...current,
        error: {
          code: "INVALID_COMMAND",
          message: "Unable to read the selected CSV file.",
          details: { cause: error instanceof Error ? error.message : String(error) },
        },
      }));
    }
  }

  function handleUseDefaultRoster() {
    const rosterText = serializeDefaultRoster(DEFAULT_PARTICIPANTS);
    setInputMode("paste");
    setPasteValue(rosterText);
    setCsvFileName(null);
    setState((current) => setParticipantPreview(current, previewParticipantsFromPaste(rosterText)));
  }

  function handleClearPreview() {
    setState((current) => clearParticipantPreview(current));
  }

  function handleApplyParticipants() {
    const preview = state.participantPreview;
    if (!preview) {
      return;
    }

    const result = applyParticipantsToAppState(state, preview, { savedAt: getTimestamp(), ...withStorage(storage) });
    commit(result);
  }

  function handlePrepareLiveDraw() {
    const result = prepareEventForLiveDraw(state, { savedAt: getTimestamp(), ...withStorage(storage) });
    commit(result);
  }

  function handleStartCountdown() {
    runLiveCommand("startCountdown", () => startLiveCountdown(state, { savedAt: getTimestamp(), ...withStorage(storage) }));
  }

  function handleStartDraw() {
    runLiveCommand("startDraw", () => startLiveDraw(state, { savedAt: getTimestamp(), ...withStorage(storage) }));
  }

  function handleSelectWinner() {
    runLiveCommand("selectWinner", () => {
      const timestamp = getTimestamp();
      const attemptId = createAttemptId ? createAttemptId() : createBrowserAttemptId(attemptCounterRef);
      return selectLiveWinner(state, {
        attemptId,
        createdAt: timestamp,
        savedAt: timestamp,
        ...(selectWinnerDependencies ? { dependencies: selectWinnerDependencies } : {}),
        ...withStorage(storage),
      });
    });
  }

  function handleFinishReveal() {
    const attemptId = state.event.currentAttemptId;
    if (state.event.phase !== "reelStopping" || !attemptId || revealCompletionAttemptRef.current === attemptId) {
      return;
    }

    revealCompletionAttemptRef.current = attemptId;
    runLiveCommand("finishReveal", () => {
      const result = finishLiveReveal(state, { savedAt: getTimestamp(), ...withStorage(storage) });
      if (!result.ok) {
        revealCompletionAttemptRef.current = null;
      }
      return result;
    });
  }

  function handleConfirmWinner() {
    runLiveCommand("confirmWinner", () => {
      const timestamp = getTimestamp();
      return confirmLiveWinner(state, { resolvedAt: timestamp, savedAt: timestamp, ...withStorage(storage) });
    });
  }

  function handleMarkAbsent() {
    runLiveCommand("markAbsent", () => {
      const timestamp = getTimestamp();
      return markLiveWinnerAbsent(state, { resolvedAt: timestamp, savedAt: timestamp, ...withStorage(storage) });
    });
  }

  function handleAdvancePrize() {
    runLiveCommand("advancePrize", () => advanceLivePrize(state, { savedAt: getTimestamp(), ...withStorage(storage) }));
  }

  function handleResumePreviousSession() {
    const result = resumeSavedSession(state, withStorage(storage));
    commit(result);
    setStartNewConfirmationOpen(false);
  }

  function handleRequestStartNewSession() {
    setStartNewConfirmationOpen(true);
  }

  function handleCancelStartNewSession() {
    setStartNewConfirmationOpen(false);
  }

  function handleConfirmStartNewSession() {
    const result = startNewSession(state, { now: getTimestamp(), ...withStorage(storage) });
    commit(result);
    setStartNewConfirmationOpen(false);
  }

  function handleClearError() {
    setState((current) => clearApplicationError(current));
  }

  return (
    <main className={`app-shell${shouldShowPresentation ? " app-shell--presentation" : ""}`}>
      <div className={`app-frame${shouldShowPresentation ? " app-frame--presentation" : ""}`}>
        {shouldShowPresentation ? (
          <PresentationStage
            state={state}
            onReturnToOperator={() => setViewMode("operator")}
            onRevealComplete={handleFinishReveal}
          />
        ) : (
          <>
            <header className="hero-band" aria-label="Application overview">
              <div className="hero-band__copy">
                <p className="eyebrow">VPBank Lucky Draw</p>
                <h1 className="app-title">{pageTitle}</h1>
                <p className="hero-band__lede">{pageLede}</p>
              </div>

              <div className="hero-band__status">
                <StatusMessage tone={heroStatus.tone} title={heroStatus.title}>
                  <p>{heroStatus.body}</p>
                </StatusMessage>
              </div>
            </header>

            {state.error && state.recovery.status !== "invalid" ? (
              <StatusMessage tone="error" title="Something needs attention">
                <p>{state.error.message}</p>
                <div className="action-row">
                  <button type="button" className="button button--secondary" onClick={handleClearError}>
                    Dismiss
                  </button>
                </div>
              </StatusMessage>
            ) : null}

            {canShowNormalSetup && shouldShowSetupConfiguration ? (
              <section className="dashboard-strip" aria-label="Current event status">
                {summaryItems.map((item) => (
                  <div key={item.label} className="dashboard-metric">
                    <span className="dashboard-metric__label">{item.label}</span>
                    <strong className="dashboard-metric__value">{item.value}</strong>
                  </div>
                ))}
                <div className="dashboard-metric dashboard-metric--wide">
                  <span className="dashboard-metric__label">Current prize</span>
                  <strong className="dashboard-metric__value">{currentPrize?.name ?? "Prize unavailable"}</strong>
                </div>
                <div className="dashboard-metric dashboard-metric--wide">
                  <span className="dashboard-metric__label">Recovery</span>
                  <strong className="dashboard-metric__value">{state.recovery.status}</strong>
                </div>
              </section>
            ) : null}

            {shouldShowLiveOperator ? (
              <LiveOperator
                phase={state.event.phase}
                currentPrize={currentPrize}
                progress={prizeProgress}
                eligibleCount={eligibleParticipantCount}
                confirmedCount={confirmedWinnerCount}
                absentCount={absentParticipantCount}
                attemptCount={state.event.attempts.length}
                currentAttempt={currentAttempt}
                pendingWinner={pendingWinner}
                confirmedWinners={confirmedWinners}
                history={eventHistory}
                primaryAction={primaryOperatorAction}
                actionInFlight={liveActionInFlight !== null}
                onOpenPresentation={() => setViewMode("presentation")}
                onStartCountdown={handleStartCountdown}
                onStartDraw={handleStartDraw}
                onSelectWinner={handleSelectWinner}
                onFinishReveal={handleFinishReveal}
                onConfirmWinner={handleConfirmWinner}
                onMarkAbsent={handleMarkAbsent}
                onAdvancePrize={handleAdvancePrize}
              />
            ) : (
              <OperatorSetup
                state={state}
                inputMode={inputMode}
                pasteValue={pasteValue}
                csvFileName={csvFileName}
                startNewConfirmationOpen={startNewConfirmationOpen}
                canApplyParticipants={canApplyParticipants}
                canPrepareLiveDraw={canPrepareLiveDraw}
                canStartLiveDraw={canStartLiveDraw}
                onInputModeChange={setInputMode}
                onPasteValueChange={setPasteValue}
                onPreviewPaste={handlePreviewPaste}
                onCsvFileSelected={(file) => {
                  void handleCsvFileSelected(file);
                }}
                onUseDefaultRoster={handleUseDefaultRoster}
                onClearPreview={handleClearPreview}
                onApplyParticipants={handleApplyParticipants}
                onPrepareLiveDraw={handlePrepareLiveDraw}
                onResumePreviousSession={handleResumePreviousSession}
                onRequestStartNewSession={handleRequestStartNewSession}
                onCancelStartNewSession={handleCancelStartNewSession}
                onConfirmStartNewSession={handleConfirmStartNewSession}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}

function serializeDefaultRoster(participants: readonly { code: string; name?: string }[]): string {
  return participants
    .map((participant) => (participant.name ? `${participant.code},${participant.name}` : participant.code))
    .join("\n");
}

function withStorage(storage?: StorageLike): { storage?: StorageLike } {
  return storage ? { storage } : {};
}

function createBrowserAttemptId(counterRef: MutableRefObject<number>): string {
  counterRef.current += 1;

  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return `attempt-${globalThis.crypto.randomUUID()}`;
  }

  return `attempt-${Date.now().toString(36)}-${counterRef.current}`;
}

function getHeroStatus(
  state: AppState,
  canStartLiveDraw: boolean,
): { tone: "info" | "success" | "warning" | "error"; title: string; body: string } {
  switch (state.recovery.status) {
    case "checking":
      return {
        tone: "info",
        title: "Checking saved session",
        body: "Looking for saved lucky draw progress on this device.",
      };
    case "recoverable":
      return {
        tone: "warning",
        title: "Previous session found",
        body: "Resume the saved state or start fresh before applying a new roster.",
      };
    case "invalid":
      return {
        tone: "error",
        title: "Saved session needs attention",
        body: "The saved data cannot be resumed. Start a new session to continue safely.",
      };
    case "noSession":
    case "resumed":
      if (canStartLiveDraw) {
        return {
          tone: "success",
          title: "Ready to begin the live draw",
          body: "The roster is valid, the event is prepared, and the next prize can be drawn.",
        };
      }

      if (state.event.phase !== "setup") {
        return {
          tone: "info",
          title: `Live phase: ${formatLivePhase(state.event.phase)}`,
          body: "Continue the active prize flow from the live operator screen.",
        };
      }

      return {
        tone: "info",
        title: "Setup is ready for participant review",
        body: "Load the default roster or paste a participant list to start validation.",
      };
  }
}

function formatLivePhase(phase: AppState["event"]["phase"]): string {
  const labels: Record<AppState["event"]["phase"], string> = {
    setup: "Setup",
    ready: "Ready",
    countdown: "Countdown",
    drawing: "Drawing",
    reelStopping: "Reel stopping",
    pendingWinner: "Pending winner",
    prizeComplete: "Prize complete",
    eventComplete: "Event complete",
  };

  return labels[phase];
}
