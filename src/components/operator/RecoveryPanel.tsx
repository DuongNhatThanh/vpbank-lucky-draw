import type { RecoveryState } from "../../state/actions";
import { StatusMessage } from "../shared/StatusMessage";

export interface RecoveryPanelProps {
  recovery: RecoveryState;
  onResumePreviousSession: () => void;
  onRequestStartNewSession: () => void;
}

export function RecoveryPanel({ recovery, onResumePreviousSession, onRequestStartNewSession }: RecoveryPanelProps) {
  if (recovery.status === "checking" || recovery.status === "noSession" || recovery.status === "resumed") {
    return null;
  }

  if (recovery.status === "invalid") {
    return (
      <section className="panel recovery-panel" aria-labelledby="recovery-panel-title">
        <div className="panel__header">
          <div>
            <p className="panel__eyebrow">Recovery</p>
            <h2 id="recovery-panel-title" className="panel__title">
              Saved session cannot be resumed
            </h2>
          </div>
          <span className="panel__badge panel__badge--warning">Invalid</span>
        </div>
        <StatusMessage tone="error" title="Saved session cannot be resumed">
          <p>The stored session is invalid. It will stay on this device until you choose to start a new session.</p>
          <p className="recovery-panel__detail">{recovery.error.message}</p>
        </StatusMessage>
        <div className="action-row">
          <button type="button" className="button button--primary" onClick={onRequestStartNewSession}>
            Start New Session
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel recovery-panel" aria-labelledby="recovery-panel-title">
      <div className="panel__header">
        <div>
          <p className="panel__eyebrow">Recovery</p>
          <h2 id="recovery-panel-title" className="panel__title">
            Previous session found
          </h2>
        </div>
        <span className="panel__badge panel__badge--warning">Session saved</span>
      </div>
      <dl className="details-grid">
        <div>
          <dt>Saved at</dt>
          <dd>{recovery.savedAt}</dd>
        </div>
        <div>
          <dt>Phase</dt>
          <dd>{recovery.phase}</dd>
        </div>
        <div>
          <dt>Prize index</dt>
          <dd>{recovery.currentPrizeIndex + 1}</dd>
        </div>
        <div>
          <dt>Pending attempt</dt>
          <dd>{recovery.hasCurrentAttempt ? "Yes" : "No"}</dd>
        </div>
      </dl>
      <div className="action-row">
        <button type="button" className="button button--primary" onClick={onResumePreviousSession}>
          Resume Previous Session
        </button>
        <button type="button" className="button button--secondary" onClick={onRequestStartNewSession}>
          Start New Session
        </button>
      </div>
    </section>
  );
}
