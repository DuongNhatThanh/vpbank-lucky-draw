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
import { playPresentationSound } from "../../presentation/audio";
import { useFullscreen } from "../../presentation/fullscreen";
import { StatusMessage } from "../shared/StatusMessage";
import { CelebrationEffect } from "./CelebrationEffect";
import { PresentationControls } from "./PresentationControls";
import { PresentationHeader } from "./PresentationHeader";
import { PrizeProgress } from "./PrizeProgress";
import { ReelDisplay } from "./ReelDisplay";
import { WinnerReveal } from "./WinnerReveal";

export interface PresentationStageProps {
  state: AppState;
  onReturnToOperator: () => void;
  onRevealComplete: () => void;
  onStartCountdown?: () => void;
  onStartDraw?: () => void;
  onSelectWinner?: () => void;
  onConfirmWinner?: () => void;
  onMarkAbsent?: () => void;
  onAdvancePrize?: () => void;
  isCommandInFlight?: boolean;
}

export function PresentationStage({
  state,
  onReturnToOperator,
  onRevealComplete,
  onStartCountdown = () => undefined,
  onStartDraw = () => undefined,
  onSelectWinner = () => undefined,
  onConfirmWinner = () => undefined,
  onMarkAbsent = () => undefined,
  onAdvancePrize = () => undefined,
  isCommandInFlight = false,
}: PresentationStageProps) {
  const stageRef = useRef<HTMLElement | null>(null);
  const currentPrize = selectCurrentPrize(state);
  const progress = selectPrizeProgress(state);
  const pendingWinner = selectCurrentPendingWinner(state);
  const confirmedWinner = selectConfirmedWinnerForCurrentPrize(state);
  const confirmedWinners = selectConfirmedWinners(state);
  const phase = state.event.phase;
  const isGrandPrize = currentPrize?.isGrandPrize ?? false;
  const [reelSettledDigits, setReelSettledDigits] = useState(0);
  const [countdownStep, setCountdownStep] = useState(3);
  const [presentationSoundEnabled, setPresentationSoundEnabled] = useState(state.event.soundEnabled);
  const prefersReducedMotion = usePrefersReducedMotion();
  const onRevealCompleteRef = useRef(onRevealComplete);
  const presentationSoundEnabledRef = useRef(presentationSoundEnabled);
  const revealAttemptRef = useRef<string | null>(null);
  const revealCompletedRef = useRef(false);
  const countdownAttemptRef = useRef<string | null>(null);
  const soundPhaseRef = useRef<EventPhase | null>(null);
  const fullscreen = useFullscreen(stageRef);

  useEffect(() => {
    setPresentationSoundEnabled(state.event.soundEnabled);
  }, [state.event.soundEnabled]);

  useEffect(() => {
    presentationSoundEnabledRef.current = presentationSoundEnabled;
  }, [presentationSoundEnabled]);

  useEffect(() => {
    if (soundPhaseRef.current === phase) {
      return;
    }

    soundPhaseRef.current = phase;
    if (phase === "drawing") {
      void playPresentationSound("drawStart", presentationSoundEnabled);
    } else if (phase === "prizeComplete") {
      void playPresentationSound(isGrandPrize ? "grandPrize" : "winnerConfirmed", presentationSoundEnabled);
    }
  }, [isGrandPrize, phase, presentationSoundEnabled]);

  useEffect(() => {
    if (phase === "countdown") {
      void playPresentationSound("countdownTick", presentationSoundEnabled);
    }
  }, [countdownStep, phase, presentationSoundEnabled]);

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
          void playPresentationSound("revealComplete", presentationSoundEnabledRef.current);
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

  const celebrationActive = phase === "prizeComplete" || phase === "eventComplete";

  return (
    <section ref={stageRef} className={`presentation-stage${isGrandPrize ? " presentation-stage--grand" : ""}`} aria-label="Presentation mode">
      <PresentationHeader
        eventName={state.event.eventName}
        onReturnToOperator={onReturnToOperator}
        fullscreenSupported={fullscreen.supported}
        fullscreenActive={fullscreen.active}
        fullscreenError={fullscreen.error}
        onToggleFullscreen={() => void fullscreen.toggle()}
        soundEnabled={presentationSoundEnabled}
        onToggleSound={() => setPresentationSoundEnabled((enabled) => !enabled)}
      />

      <div className="presentation-stage__body">
        <PrizeProgress prize={currentPrize} progress={progress} />

        <section className={`presentation-canvas presentation-canvas--${phase}`} aria-live="polite">
          <div className="presentation-canvas__visual">
            {renderVisualState(phase, reelSettledDigits, countdownStep, isGrandPrize, pendingWinner, confirmedWinner, confirmedWinners)}
          </div>
          <div className="presentation-canvas__status">{renderPhaseStatus(phase, currentPrize?.name, pendingWinner, confirmedWinners.length)}</div>
        </section>
      </div>
      {phase !== "setup" && phase !== "eventComplete" ? (
        <div className="presentation-stage__controls">
          <PresentationControls
            phase={phase}
            pendingWinner={pendingWinner}
            isCommandInFlight={isCommandInFlight}
            onStartCountdown={onStartCountdown}
            onStartDraw={onStartDraw}
            onSelectWinner={onSelectWinner}
            onConfirmWinner={onConfirmWinner}
            onMarkAbsent={onMarkAbsent}
            onAdvancePrize={onAdvancePrize}
          />
        </div>
      ) : null}
      <CelebrationEffect active={celebrationActive} enhanced={isGrandPrize || phase === "eventComplete"} reducedMotion={prefersReducedMotion} />
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
        <p className="presentation-winners__eyebrow">Lucky Draw Complete</p>
        <h2 className="presentation-winners__title">Thank you for celebrating with us</h2>
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
  currentPrizeName: string | undefined,
  pendingWinner: Participant | undefined,
  confirmedWinnerCount: number,
) {
  if (phase === "setup") {
    return (
      <StatusMessage tone="info" title="Presentation is not active yet">
        <p>Complete setup before the live presentation starts.</p>
      </StatusMessage>
    );
  }

  if (phase === "ready") {
    return (
      <StatusMessage tone="info" title={`Ready for ${currentPrizeName ?? "the next prize"}`}>
        <p>Tap Start Draw when the MC is ready.</p>
      </StatusMessage>
    );
  }

  if (phase === "countdown") {
    return (
      <StatusMessage tone="info" title="Get Ready">
        <p>Three, two, one.</p>
      </StatusMessage>
    );
  }

  if (phase === "drawing") {
    return (
      <StatusMessage tone="info" title="Drawing...">
        <p>The winning code will appear once it is safely saved.</p>
      </StatusMessage>
    );
  }

  if (phase === "reelStopping") {
    return (
      <StatusMessage tone="success" title="Winning Number">
        <p>The selected code is revealing now.</p>
      </StatusMessage>
    );
  }

  if (phase === "pendingWinner") {
    return (
      <StatusMessage tone="warning" title="Winning Number">
        <p>{pendingWinner ? `${pendingWinner.code} is waiting for confirmation.` : "A winner is waiting for confirmation."}</p>
      </StatusMessage>
    );
  }

  if (phase === "prizeComplete") {
    return (
      <StatusMessage tone="success" title="Winner Confirmed">
        <p>Move to the next prize when the MC is ready.</p>
      </StatusMessage>
    );
  }

  return (
    <StatusMessage tone="success" title="Event Complete">
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
