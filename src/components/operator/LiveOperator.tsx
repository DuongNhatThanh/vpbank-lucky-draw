import type { EventHistoryItem, PrimaryOperatorAction, PrizeProgress } from "../../state/selectors";
import type { DrawAttempt, EventPhase, Participant, Prize } from "../../domain/types";
import { StatusMessage } from "../shared/StatusMessage";

export interface LiveOperatorProps {
  phase: EventPhase;
  currentPrize: Prize | undefined;
  progress: PrizeProgress;
  eligibleCount: number;
  confirmedCount: number;
  absentCount: number;
  attemptCount: number;
  currentAttempt: DrawAttempt | undefined;
  pendingWinner: Participant | undefined;
  confirmedWinners: readonly EventHistoryItem[];
  history: readonly EventHistoryItem[];
  primaryAction: PrimaryOperatorAction;
  actionInFlight?: boolean;
  onStartCountdown: () => void;
  onStartDraw: () => void;
  onSelectWinner: () => void;
  onFinishReveal: () => void;
  onConfirmWinner: () => void;
  onMarkAbsent: () => void;
  onAdvancePrize: () => void;
}

export function LiveOperator({
  phase,
  currentPrize,
  progress,
  eligibleCount,
  confirmedCount,
  absentCount,
  attemptCount,
  currentAttempt,
  pendingWinner,
  confirmedWinners,
  history,
  primaryAction,
  actionInFlight = false,
  onStartCountdown,
  onStartDraw,
  onSelectWinner,
  onFinishReveal,
  onConfirmWinner,
  onMarkAbsent,
  onAdvancePrize,
}: LiveOperatorProps) {
  const phaseLabel = formatEventPhase(phase);

  return (
    <div className="operator-shell live-operator">
      <section className="panel live-hero" aria-labelledby="live-operator-title">
        <div className="panel__header">
          <div>
            <p className="panel__eyebrow">Live Operator Flow</p>
            <h2 id="live-operator-title" className="panel__title">
              {currentPrize?.name ?? "Prize unavailable"}
            </h2>
          </div>
          <span className="panel__badge panel__badge--success">Prize {progress.label}</span>
        </div>

        <div className="live-status-grid">
          <LiveMetric label="Phase" value={phaseLabel} />
          <LiveMetric label="Eligible" value={eligibleCount} />
          <LiveMetric label="Confirmed" value={confirmedCount} />
          <LiveMetric label="Absent" value={absentCount} />
        </div>

        <PhaseStatus
          phase={phase}
          pendingWinner={pendingWinner}
          currentAttempt={currentAttempt}
          confirmedWinners={confirmedWinners}
          absentCount={absentCount}
          attemptCount={attemptCount}
        />

        <PrimaryControls
          action={primaryAction}
          actionInFlight={actionInFlight}
          pendingWinner={pendingWinner}
          onStartCountdown={onStartCountdown}
          onStartDraw={onStartDraw}
          onSelectWinner={onSelectWinner}
          onFinishReveal={onFinishReveal}
          onConfirmWinner={onConfirmWinner}
          onMarkAbsent={onMarkAbsent}
          onAdvancePrize={onAdvancePrize}
        />
      </section>

      <section className="panel history-panel" aria-labelledby="history-title">
        <div className="panel__header">
          <div>
            <p className="panel__eyebrow">History</p>
            <h2 id="history-title" className="panel__title">
              Results and absent attempts
            </h2>
          </div>
          <span className="panel__badge">{history.length} resolved</span>
        </div>

        {history.length > 0 ? (
          <ul className="history-list" aria-label="Resolved draw history">
            {history.map((item) => (
              <li key={item.attempt.id} className={`history-item history-item--${item.attempt.status}`}>
                <span className="history-item__prize">{item.prize?.name ?? "Prize unavailable"}</span>
                <strong className="history-item__code">{item.participant?.code ?? "----"}</strong>
                {item.participant?.name ? <span className="history-item__name">{item.participant.name}</span> : null}
                <span className="history-item__status">{item.attempt.status}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-state">No confirmed or absent attempts yet.</p>
        )}
      </section>
    </div>
  );
}

function PrimaryControls({
  action,
  actionInFlight,
  pendingWinner,
  onStartCountdown,
  onStartDraw,
  onSelectWinner,
  onFinishReveal,
  onConfirmWinner,
  onMarkAbsent,
  onAdvancePrize,
}: {
  action: PrimaryOperatorAction;
  actionInFlight: boolean;
  pendingWinner: Participant | undefined;
  onStartCountdown: () => void;
  onStartDraw: () => void;
  onSelectWinner: () => void;
  onFinishReveal: () => void;
  onConfirmWinner: () => void;
  onMarkAbsent: () => void;
  onAdvancePrize: () => void;
}) {
  if (action === "startCountdown") {
    return (
      <div className="action-row live-actions">
        <button type="button" className="button button--primary" onClick={onStartCountdown} disabled={actionInFlight}>
          Start Draw
        </button>
      </div>
    );
  }

  if (action === "startDraw") {
    return (
      <div className="action-row live-actions">
        <button type="button" className="button button--primary" onClick={onStartDraw} disabled={actionInFlight}>
          Complete Countdown
        </button>
      </div>
    );
  }

  if (action === "selectWinner") {
    return (
      <div className="action-row live-actions">
        <button type="button" className="button button--primary" onClick={onSelectWinner} disabled={actionInFlight}>
          Select Winner
        </button>
      </div>
    );
  }

  if (action === "finishReveal") {
    return (
      <div className="action-row live-actions">
        <button type="button" className="button button--primary" onClick={onFinishReveal} disabled={actionInFlight}>
          Complete Reveal
        </button>
      </div>
    );
  }

  if (action === "confirmOrAbsent") {
    return (
      <div className="action-row live-actions">
        <button type="button" className="button button--primary" onClick={onConfirmWinner} disabled={!pendingWinner || actionInFlight}>
          Confirm Winner
        </button>
        <button type="button" className="button button--danger" onClick={onMarkAbsent} disabled={!pendingWinner || actionInFlight}>
          Mark Absent & Redraw
        </button>
      </div>
    );
  }

  if (action === "advancePrize") {
    return (
      <div className="action-row live-actions">
        <button type="button" className="button button--primary" onClick={onAdvancePrize} disabled={actionInFlight}>
          Next Prize
        </button>
      </div>
    );
  }

  return null;
}

function PhaseStatus({
  phase,
  pendingWinner,
  currentAttempt,
  confirmedWinners,
  absentCount,
  attemptCount,
}: {
  phase: EventPhase;
  pendingWinner: Participant | undefined;
  currentAttempt: DrawAttempt | undefined;
  confirmedWinners: readonly EventHistoryItem[];
  absentCount: number;
  attemptCount: number;
}) {
  if (phase === "reelStopping") {
    return (
      <StatusMessage tone="success" title="Winner selected and safely saved">
        <WinnerSummary participant={pendingWinner} fallback="The selected winner is persisted. Complete the temporary reveal step to continue." />
      </StatusMessage>
    );
  }

  if (phase === "pendingWinner") {
    return (
      <StatusMessage tone="warning" title="Pending winner">
        <WinnerSummary participant={pendingWinner} fallback="Confirm the winner if present, or mark absent to redraw this same prize." />
        <p>The same prize cannot advance until this pending winner is resolved.</p>
      </StatusMessage>
    );
  }

  if (phase === "prizeComplete") {
    return (
      <StatusMessage tone="success" title="Winner confirmed">
        <p>The current prize is complete. Use Next Prize when the MC is ready to continue.</p>
      </StatusMessage>
    );
  }

  if (phase === "eventComplete") {
    return (
      <StatusMessage tone="success" title="Event complete">
        <p>
          Six confirmed winners recorded. Confirmed: {confirmedWinners.length}. Absent: {absentCount}. Attempts: {attemptCount}.
        </p>
        <ul className="winner-summary-list" aria-label="Final confirmed winners">
          {confirmedWinners.map((item) => (
            <li key={item.attempt.id}>
              <strong>{item.participant?.code ?? "----"}</strong>
              <span>{item.prize?.name ?? "Prize unavailable"}</span>
              {item.participant?.name ? <span>{item.participant.name}</span> : null}
            </li>
          ))}
        </ul>
      </StatusMessage>
    );
  }

  if (phase === "countdown") {
    return (
      <StatusMessage tone="info" title="Countdown in progress">
        <p>Presentation countdown is not animated yet. Continue when the operator is ready.</p>
      </StatusMessage>
    );
  }

  if (phase === "drawing") {
    return (
      <StatusMessage tone="info" title="Ready to select winner">
        <p>The next action delegates to the secure draw engine. No result is chosen by the UI.</p>
      </StatusMessage>
    );
  }

  if (currentAttempt) {
    return (
      <StatusMessage tone="info" title="Attempt in progress">
        <p>Attempt {currentAttempt.id} is active.</p>
      </StatusMessage>
    );
  }

  return (
    <StatusMessage tone="info" title="Prize ready">
      <p>Start the draw when the MC is ready.</p>
    </StatusMessage>
  );
}

function WinnerSummary({ participant, fallback }: { participant: Participant | undefined; fallback: string }) {
  if (!participant) {
    return <p>{fallback}</p>;
  }

  return (
    <div className="winner-summary">
      <span className="winner-summary__label">Winning code</span>
      <strong className="winner-summary__code">{participant.code}</strong>
      {participant.name ? <span className="winner-summary__name">{participant.name}</span> : null}
    </div>
  );
}

function LiveMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric">
      <span className="metric__label">{label}</span>
      <strong className="metric__value">{value}</strong>
    </div>
  );
}

function formatEventPhase(phase: EventPhase): string {
  const labels: Record<EventPhase, string> = {
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
