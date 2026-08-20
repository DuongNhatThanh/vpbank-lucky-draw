import { useEffect, useRef, useState } from "react";
import type { EventPhase, Participant } from "../../domain/types";
import type { AppState } from "../../state/actions";
import type { EventHistoryItem } from "../../state/selectors";
import {
  selectConfirmedWinnerForCurrentPrize,
  selectConfirmedWinners,
  selectCurrentPendingWinner,
  selectCurrentPrize,
  selectPrizeProgress,
} from "../../state/selectors";
import { PRESENTATION_TIMING } from "../../presentation/timing";
import { StatusMessage } from "../shared/StatusMessage";
import { PresentationHeader } from "./PresentationHeader";
import { PrizeProgress } from "./PrizeProgress";
import { ReelDisplay } from "./ReelDisplay";
import { WinnerReveal } from "./WinnerReveal";

export interface PresentationStageProps {
  state: AppState;
  onReturnToOperator: () => void;
  onRevealComplete: () => void;
}

export function PresentationStage({ state, onReturnToOperator, onRevealComplete }: PresentationStageProps) {
  const currentPrize = selectCurrentPrize(state);
  const progress = selectPrizeProgress(state);
  const pendingWinner = selectCurrentPendingWinner(state);
  const confirmedWinner = selectConfirmedWinnerForCurrentPrize(state);
  const confirmedWinners = selectConfirmedWinners(state);
  const phase = state.event.phase;
  const isGrandPrize = currentPrize?.isGrandPrize ?? false;
  const [reelSettledDigits, setReelSettledDigits] = useState(0);
  const [countdownStep, setCountdownStep] = useState(3);
  const prefersReducedMotion = usePrefersReducedMotion();
  const onRevealCompleteRef = useRef(onRevealComplete);
  const revealAttemptRef = useRef<string | null>(null);
  const revealCompletedRef = useRef(false);
  const countdownAttemptRef = useRef<string | null>(null);

  useEffect(() => {
    onRevealCompleteRef.current = onRevealComplete;
  }, [onRevealComplete]);

  useEffect(() => {
    if (phase !== "reelStopping") {
      revealAttemptRef.current = null;
      revealCompletedRef.current = false;
      setReelSettledDigits(0);
      return;
    }

    if (revealAttemptRef.current !== state.event.currentAttemptId) {
      revealAttemptRef.current = state.event.currentAttemptId ?? null;
      revealCompletedRef.current = false;
    }

    if (prefersReducedMotion) {
      setReelSettledDigits(4);
      return;
    }

    setReelSettledDigits(0);
    const timers = PRESENTATION_TIMING.reelDigitStopsMs.map((delayMs, index) =>
      window.setTimeout(() => {
        setReelSettledDigits(index + 1);
        if (index === PRESENTATION_TIMING.reelDigitStopsMs.length - 1) {
          triggerRevealComplete();
        }
      }, delayMs),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [phase, prefersReducedMotion, state.event.currentAttemptId]);

  useEffect(() => {
    if (phase !== "reelStopping" || reelSettledDigits < 4) {
      return;
    }

    if (revealCompletedRef.current || revealAttemptRef.current !== state.event.currentAttemptId) {
      return;
    }

    const timer = window.setTimeout(triggerRevealComplete, prefersReducedMotion ? PRESENTATION_TIMING.reducedMotionCompleteMs : 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [phase, prefersReducedMotion, reelSettledDigits, state.event.currentAttemptId]);

  useEffect(() => {
    if (phase !== "countdown") {
      countdownAttemptRef.current = null;
      setCountdownStep(3);
      return;
    }

    if (countdownAttemptRef.current !== state.event.currentAttemptId) {
      countdownAttemptRef.current = state.event.currentAttemptId ?? null;
      setCountdownStep(3);
    }

    if (prefersReducedMotion) {
      setCountdownStep(1);
      return;
    }

    setCountdownStep(3);
    const timers = [
      window.setTimeout(() => {
        setCountdownStep(2);
      }, PRESENTATION_TIMING.countdownStepMs),
      window.setTimeout(() => {
        setCountdownStep(1);
      }, PRESENTATION_TIMING.countdownStepMs * 2),
    ];

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [phase, prefersReducedMotion, state.event.currentAttemptId]);

  function triggerRevealComplete() {
    if (revealCompletedRef.current) {
      return;
    }

    revealCompletedRef.current = true;
    onRevealCompleteRef.current();
  }

  return (
    <section className="presentation-stage" aria-label="Presentation mode">
      <PresentationHeader eventName={state.event.eventName} onReturnToOperator={onReturnToOperator} />

      <div className="presentation-stage__body">
        <PrizeProgress prize={currentPrize} progress={progress} />

        <section className={`presentation-canvas presentation-canvas--${phase}`} aria-live="polite">
          <div className="presentation-canvas__visual">
            {renderVisualState(phase, reelSettledDigits, countdownStep, isGrandPrize, pendingWinner, confirmedWinner, confirmedWinners)}
          </div>
          <div className="presentation-canvas__status">{renderPhaseStatus(phase, pendingWinner, confirmedWinners.length)}</div>
        </section>
      </div>
    </section>
  );
}

function renderVisualState(
  phase: EventPhase,
  settledDigits: number,
  countdownStep: number,
  isGrandPrize: boolean,
  pendingWinner: Participant | undefined,
  confirmedWinner: EventHistoryItem | undefined,
  confirmedWinners: readonly EventHistoryItem[],
) {
  if (phase === "pendingWinner") {
    return <WinnerReveal code={pendingWinner?.code ?? ""} participant={pendingWinner} isGrandPrize={isGrandPrize} />;
  }

  if (phase === "prizeComplete") {
    if (!confirmedWinner?.participant?.code) {
      return (
        <StatusMessage tone="warning" title="Confirmed winner unavailable">
          <p>The confirmed winner for this prize could not be found.</p>
        </StatusMessage>
      );
    }

    return <WinnerReveal code={confirmedWinner.participant.code} participant={confirmedWinner.participant} isGrandPrize={isGrandPrize} />;
  }

  if (phase === "eventComplete") {
    return (
      <section className="presentation-winners" aria-label="Confirmed winners">
        <div className="presentation-winners__summary">
          <span className="presentation-winners__count">{confirmedWinners.length}</span>
          <p className="presentation-winners__label">Confirmed prize winners</p>
        </div>
        <ul className="presentation-winners__list">
          {confirmedWinners.map((winner) => (
            <li key={winner.attempt.id} className="presentation-winners__item">
              <span className="presentation-winners__prize">{winner.prize?.name ?? "Prize unavailable"}</span>
              <strong className="presentation-winners__code">{winner.participant?.code ?? "----"}</strong>
              {winner.participant?.name ? <span className="presentation-winners__name">{winner.participant.name}</span> : null}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (phase === "countdown") {
    return (
      <section className="presentation-countdown" aria-label="Presentation countdown">
        <span className="presentation-countdown__label">Starting in</span>
        <strong className="presentation-countdown__value" data-testid="presentation-countdown-value">
          {countdownStep}
        </strong>
      </section>
    );
  }

  if (phase === "reelStopping") {
    return <ReelDisplay code={pendingWinner?.code ?? null} settledDigits={settledDigits} isGrandPrize={isGrandPrize} />;
  }

  if (phase === "drawing") {
    return <ReelDisplay code={null} settledDigits={0} isGrandPrize={isGrandPrize} />;
  }

  return <ReelDisplay code={null} settledDigits={4} isGrandPrize={isGrandPrize} />;
}

function renderPhaseStatus(
  phase: EventPhase,
  pendingWinner: Participant | undefined,
  confirmedWinnerCount: number,
) {
  if (phase === "setup") {
    return (
      <StatusMessage tone="info" title="Presentation is not active yet">
        <p>Complete operator setup before entering the audience presentation.</p>
      </StatusMessage>
    );
  }

  if (phase === "ready") {
    return (
      <StatusMessage tone="info" title="Ready for the next prize">
        <p>The draw is armed and waiting for the operator to begin.</p>
      </StatusMessage>
    );
  }

  if (phase === "countdown") {
    return (
      <StatusMessage tone="info" title="Countdown in progress">
        <p>The audience view is ready. Continue when the countdown reaches its final beat.</p>
      </StatusMessage>
    );
  }

  if (phase === "drawing") {
    return (
      <StatusMessage tone="info" title="Selecting the official winner">
        <p>The reels are visual only. The official result is chosen by the draw engine, not by the presentation UI.</p>
      </StatusMessage>
    );
  }

  if (phase === "reelStopping") {
    return (
      <StatusMessage tone="success" title="Winner selected and persisted">
        <p>The winning code is already locked in. The presentation is only revealing that saved result.</p>
      </StatusMessage>
    );
  }

  if (phase === "pendingWinner") {
    return (
      <StatusMessage tone="warning" title="Awaiting winner confirmation">
        <p>{pendingWinner ? `Winning code ${pendingWinner.code} is pending confirmation from the operator.` : "A pending winner is awaiting confirmation."}</p>
      </StatusMessage>
    );
  }

  if (phase === "prizeComplete") {
    return (
      <StatusMessage tone="success" title="Prize winner confirmed">
        <p>The current prize is complete. The operator can advance when the MC is ready.</p>
      </StatusMessage>
    );
  }

  return (
    <StatusMessage tone="success" title="Event complete">
      <p>All six prizes have confirmed winners. Total confirmed winners: {confirmedWinnerCount}.</p>
    </StatusMessage>
  );
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyPreference = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };

    applyPreference();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", applyPreference);
      return () => {
        mediaQuery.removeEventListener("change", applyPreference);
      };
    }

    mediaQuery.addListener(applyPreference);
    return () => {
      mediaQuery.removeListener(applyPreference);
    };
  }, []);

  return prefersReducedMotion;
}
