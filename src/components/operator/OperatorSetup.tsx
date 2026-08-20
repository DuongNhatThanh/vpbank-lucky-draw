import type { AppState } from "../../state/actions";
import type { InputMode } from "./ParticipantImportPanel";
import { ParticipantImportPanel } from "./ParticipantImportPanel";
import { PrizeReview } from "./PrizeReview";
import { RecoveryPanel } from "./RecoveryPanel";
import { StatusMessage } from "../shared/StatusMessage";

export interface OperatorSetupProps {
  state: AppState;
  inputMode: InputMode;
  pasteValue: string;
  csvFileName: string | null;
  startNewConfirmationOpen: boolean;
  canApplyParticipants: boolean;
  canPrepareLiveDraw: boolean;
  canStartLiveDraw: boolean;
  onInputModeChange: (mode: InputMode) => void;
  onPasteValueChange: (value: string) => void;
  onPreviewPaste: () => void;
  onCsvFileSelected: (file: File | null) => void;
  onUseDefaultRoster: () => void;
  onClearPreview: () => void;
  onApplyParticipants: () => void;
  onPrepareLiveDraw: () => void;
  onResumePreviousSession: () => void;
  onRequestStartNewSession: () => void;
  onCancelStartNewSession: () => void;
  onConfirmStartNewSession: () => void;
}

export function OperatorSetup({
  state,
  inputMode,
  pasteValue,
  csvFileName,
  startNewConfirmationOpen,
  canApplyParticipants,
  canPrepareLiveDraw,
  canStartLiveDraw,
  onInputModeChange,
  onPasteValueChange,
  onPreviewPaste,
  onCsvFileSelected,
  onUseDefaultRoster,
  onClearPreview,
  onApplyParticipants,
  onPrepareLiveDraw,
  onResumePreviousSession,
  onRequestStartNewSession,
  onCancelStartNewSession,
  onConfirmStartNewSession,
}: OperatorSetupProps) {
  const currentPrize = state.event.prizes.find((prize) => prize.index === state.event.currentPrizeIndex);

  if (state.recovery.status === "checking") {
    return (
      <div className="operator-shell">
        <StatusMessage tone="info" title="Checking saved session">
          <p>Looking for saved lucky draw progress on this device.</p>
        </StatusMessage>
      </div>
    );
  }

  if (state.recovery.status === "recoverable" || state.recovery.status === "invalid") {
    return (
      <div className="operator-shell">
        <RecoveryPanel
          recovery={state.recovery}
          onResumePreviousSession={onResumePreviousSession}
          onRequestStartNewSession={onRequestStartNewSession}
        />
        <StartNewConfirmationDialog
          open={startNewConfirmationOpen}
          onCancelStartNewSession={onCancelStartNewSession}
          onConfirmStartNewSession={onConfirmStartNewSession}
        />
      </div>
    );
  }

  return (
    <div className="operator-shell">
      <div className="operator-grid">
        <ParticipantImportPanel
          inputMode={inputMode}
          pasteValue={pasteValue}
          csvFileName={csvFileName}
          validationPreview={state.participantPreview}
          appliedParticipantCount={state.event.participants.length}
          canApplyParticipants={canApplyParticipants}
          onInputModeChange={onInputModeChange}
          onPasteValueChange={onPasteValueChange}
          onPreviewPaste={onPreviewPaste}
          onCsvFileSelected={onCsvFileSelected}
          onUseDefaultRoster={onUseDefaultRoster}
          onClearPreview={onClearPreview}
          onApplyParticipants={onApplyParticipants}
        />

        <PrizeReview
          prizes={state.event.prizes}
          currentPrizeIndex={state.event.currentPrizeIndex}
          phase={state.event.phase}
          appliedParticipantCount={state.event.participants.length}
          canPrepareLiveDraw={canPrepareLiveDraw}
          canStartLiveDraw={canStartLiveDraw}
          onPrepareLiveDraw={onPrepareLiveDraw}
        />
      </div>

      <section className="panel setup-footer" aria-labelledby="setup-footer-title">
        <div className="panel__header panel__header--compact">
          <div>
            <p className="panel__eyebrow">Readiness</p>
            <h2 id="setup-footer-title" className="panel__title">
              Setup status
            </h2>
          </div>
          <span className={`panel__badge${state.event.phase === "ready" ? " panel__badge--success" : ""}`}>
            {state.event.phase === "ready" ? "Ready to draw" : "Setup mode"}
          </span>
        </div>
        <dl className="details-grid details-grid--single">
          <div>
            <dt>Current prize</dt>
            <dd>{currentPrize?.name ?? "Prize unavailable"}</dd>
          </div>
          <div>
            <dt>Validation preview</dt>
            <dd>{state.participantPreview ? "Preview loaded" : "No preview pending"}</dd>
          </div>
        </dl>
      </section>

      <StartNewConfirmationDialog
        open={startNewConfirmationOpen}
        onCancelStartNewSession={onCancelStartNewSession}
        onConfirmStartNewSession={onConfirmStartNewSession}
      />
    </div>
  );
}

function StartNewConfirmationDialog({
  open,
  onCancelStartNewSession,
  onConfirmStartNewSession,
}: {
  open: boolean;
  onCancelStartNewSession: () => void;
  onConfirmStartNewSession: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="start-new-title">
        <p className="panel__eyebrow">Confirmation</p>
        <h2 id="start-new-title" className="panel__title">
          Start a new session?
        </h2>
        <p>Starting a new session will erase saved lucky draw progress on this device.</p>
        <div className="action-row">
          <button type="button" className="button button--secondary" onClick={onCancelStartNewSession}>
            Cancel
          </button>
          <button type="button" className="button button--danger" onClick={onConfirmStartNewSession}>
            Start New Session
          </button>
        </div>
      </section>
    </div>
  );
}
