import type { EventPhase, Participant } from "../../domain/types";

export interface PresentationControlsProps {
  phase: EventPhase;
  pendingWinner: Participant | undefined;
  isCommandInFlight: boolean;
  onStartCountdown: () => void;
  onStartDraw: () => void;
  onSelectWinner: () => void;
  onConfirmWinner: () => void;
  onMarkAbsent: () => void;
  onAdvancePrize: () => void;
}

export function PresentationControls({
  phase,
  pendingWinner,
  isCommandInFlight,
  onStartCountdown,
  onStartDraw,
  onSelectWinner,
  onConfirmWinner,
  onMarkAbsent,
  onAdvancePrize,
}: PresentationControlsProps) {
  if (phase === "setup" || phase === "eventComplete") {
    return null;
  }

  if (phase === "reelStopping") {
    return (
      <section className="presentation-controls" aria-label="MC live controls">
        <p className="presentation-controls__status">Revealing winner...</p>
      </section>
    );
  }

  if (phase === "ready") {
    return (
      <section className="presentation-controls" aria-label="MC live controls">
        <button type="button" className="button button--primary" onClick={onStartCountdown} disabled={isCommandInFlight}>
          Start Draw
        </button>
      </section>
    );
  }

  if (phase === "countdown") {
    return (
      <section className="presentation-controls" aria-label="MC live controls">
        <button type="button" className="button button--primary" onClick={onStartDraw} disabled={isCommandInFlight}>
          Complete Countdown
        </button>
      </section>
    );
  }

  if (phase === "drawing") {
    return (
      <section className="presentation-controls" aria-label="MC live controls">
        <button type="button" className="button button--primary" onClick={onSelectWinner} disabled={isCommandInFlight}>
          Select Winner
        </button>
      </section>
    );
  }

  if (phase === "pendingWinner") {
    return (
      <section className="presentation-controls" aria-label="MC live controls">
        <button type="button" className="button button--primary" onClick={onConfirmWinner} disabled={!pendingWinner || isCommandInFlight}>
          Confirm Winner
        </button>
        <button type="button" className="button button--danger" onClick={onMarkAbsent} disabled={!pendingWinner || isCommandInFlight}>
          Mark Absent & Redraw
        </button>
      </section>
    );
  }

  if (phase === "prizeComplete") {
    return (
      <section className="presentation-controls" aria-label="MC live controls">
        <button type="button" className="button button--primary" onClick={onAdvancePrize} disabled={isCommandInFlight}>
          Next Prize
        </button>
      </section>
    );
  }

  return null;
}
