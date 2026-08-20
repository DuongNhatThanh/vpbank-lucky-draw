import { useEffect, useMemo, useState } from "react";
import { DEFAULT_PARTICIPANTS } from "./data/defaultParticipants";
import type { AppResult } from "./domain/types";
import { previewParticipantsFromCsv, previewParticipantsFromPaste } from "./services/participantImport";
import type { StorageLike } from "./services/persistence";
import { OperatorSetup } from "./components/operator/OperatorSetup";
import { StatusMessage } from "./components/shared/StatusMessage";
import type { AppState } from "./state/actions";
import {
  applyParticipantsToAppState,
  clearApplicationError,
  clearParticipantPreview,
  initializeAppState,
  prepareEventForLiveDraw,
  resumeSavedSession,
  setParticipantPreview,
  startNewSession,
} from "./state/appController";
import {
  selectAbsentParticipantCount,
  selectCanApplyParticipants,
  selectCanPrepareLiveDraw,
  selectCanStartLiveDraw,
  selectConfirmedWinnerCount,
  selectCurrentPrize,
  selectEligibleParticipantCount,
  selectPendingParticipant,
} from "./state/selectors";

export interface AppProps {
  storage?: StorageLike;
  now?: string;
}

export default function App({ storage, now }: AppProps) {
  const [bootTime] = useState(() => now ?? new Date().toISOString());
  const [state, setState] = useState<AppState>(() => initializeAppState({ now: bootTime, ...withStorage(storage) }));
  const [inputMode, setInputMode] = useState<"paste" | "csv">("paste");
  const [pasteValue, setPasteValue] = useState(() => serializeDefaultRoster(DEFAULT_PARTICIPANTS));
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [startNewConfirmationOpen, setStartNewConfirmationOpen] = useState(false);
  const getTimestamp = () => now ?? new Date().toISOString();

  useEffect(() => {
    if (state.error && state.recovery.status !== "invalid") {
      document.title = `VPBank Lucky Draw - ${state.error.message}`;
    } else {
      document.title = "VPBank Lucky Draw";
    }
  }, [state.error, state.recovery.status]);

  const currentPrize = selectCurrentPrize(state);
  const eligibleParticipantCount = selectEligibleParticipantCount(state);
  const confirmedWinnerCount = selectConfirmedWinnerCount(state);
  const absentParticipantCount = selectAbsentParticipantCount(state);
  const pendingParticipant = selectPendingParticipant(state);
  const canApplyParticipants = selectCanApplyParticipants(state);
  const canPrepareLiveDraw = selectCanPrepareLiveDraw(state);
  const canStartLiveDraw = selectCanStartLiveDraw(state);
  const canShowNormalSetup = state.recovery.status === "noSession" || state.recovery.status === "resumed";
  const heroStatus = getHeroStatus(state, canStartLiveDraw);

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
    <main className="app-shell">
      <div className="app-frame">
        <header className="hero-band" aria-label="Application overview">
          <div className="hero-band__copy">
            <p className="eyebrow">VPBank Lucky Draw</p>
            <h1 className="app-title">Operator setup</h1>
            <p className="hero-band__lede">
              Prepare the participant roster, review six prizes, and move safely into the live draw flow.
            </p>
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

        {canShowNormalSetup ? (
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

      return {
        tone: "info",
        title: "Setup is ready for participant review",
        body: "Load the default roster or paste a participant list to start validation.",
      };
  }
}
