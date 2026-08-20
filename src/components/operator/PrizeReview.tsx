import type { EventPhase, Prize } from "../../domain/types";
import { StatusMessage } from "../shared/StatusMessage";

export interface PrizeReviewProps {
  prizes: readonly Prize[];
  currentPrizeIndex: number;
  phase: EventPhase;
  appliedParticipantCount: number;
  canPrepareLiveDraw: boolean;
  canStartLiveDraw: boolean;
  onPrepareLiveDraw: () => void;
}

export function PrizeReview({
  prizes,
  currentPrizeIndex,
  phase,
  appliedParticipantCount,
  canPrepareLiveDraw,
  canStartLiveDraw,
  onPrepareLiveDraw,
}: PrizeReviewProps) {
  const currentPrize = prizes.find((prize) => prize.index === currentPrizeIndex);

  return (
    <section className="panel prize-panel" aria-labelledby="prize-panel-title">
      <div className="panel__header">
        <div>
          <p className="panel__eyebrow">Event / Prize</p>
          <h2 id="prize-panel-title" className="panel__title">
            Six-prize review
          </h2>
        </div>
        <div className="panel__badge">Roster {appliedParticipantCount}</div>
      </div>

      <div className="prize-summary">
        <div>
          <span className="field__label">Current prize</span>
          <strong>{currentPrize?.name ?? "Prize not ready"}</strong>
        </div>
        <div>
          <span className="field__label">Phase</span>
          <strong>{formatEventPhase(phase)}</strong>
        </div>
      </div>

      {canPrepareLiveDraw ? (
        <StatusMessage tone="info" title="Roster is ready to move forward">
          <p>Participants are valid, prizes are complete, and the setup can be prepared for the live draw flow.</p>
          <div className="action-row">
            <button type="button" className="button button--primary" onClick={onPrepareLiveDraw}>
              Continue to Live Draw
            </button>
          </div>
        </StatusMessage>
      ) : canStartLiveDraw ? (
        <StatusMessage tone="success" title="Ready for the live draw">
          <p>The setup has been prepared. The next phase can begin when the live draw screen is available.</p>
        </StatusMessage>
      ) : (
        <StatusMessage tone="warning" title="Setup still needs attention">
          <p>Finish participant setup before proceeding to the live draw flow.</p>
        </StatusMessage>
      )}

      <ul className="prize-list" aria-label="Prize list">
        {prizes.map((prize) => {
          const isActive = prize.index === currentPrizeIndex;

          return (
            <li key={prize.id} className={`prize-item${prize.isGrandPrize ? " prize-item--grand" : ""}${isActive ? " is-active" : ""}`}>
              <span className="prize-item__index">Prize {prize.index + 1}</span>
              <strong className="prize-item__name">{prize.name}</strong>
              {prize.isGrandPrize ? <span className="prize-item__tag">Grand Prize</span> : null}
            </li>
          );
        })}
      </ul>
    </section>
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
