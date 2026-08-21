import { useEffect, useMemo, useRef, useState } from "react";
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
import { createPresentationAudioController } from "../../presentation/audio";
import { PRESENTATION_TIMING } from "../../presentation/timing";
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
  const audioController = useMemo(() => createPresentationAudioController(), []);
  const onRevealCompleteRef = useRef(onRevealComplete);
  const presentationSoundEnabledRef = useRef(presentationSoundEnabled);
  const revealAttemptRef = useRef<string | null>(null);
  const revealCompletedRef = useRef(false);
  const countdownAttemptRef = useRef<string | null>(null);
  const countdownSoundHandledRef = useRef(false);
  const countdownAutoAdvanceScheduledRef = useRef(false);
  const revealHoldTimeoutRef = useRef<number | null>(null);
  const fullscreen = useFullscreen(stageRef);

  useEffect(() => {
    setPresentationSoundEnabled(state.event.soundEnabled);
  }, [state.event.soundEnabled]);

  useEffect(() => {
    presentationSoundEnabledRef.current = presentationSoundEnabled;
  }, [presentationSoundEnabled]);

  useEffect(() => {
    if (phase === "drawing" || phase === "reelStopping") {
      audioController.stopOneShot("countdownTick");
      void audioController.startLoop(presentationSoundEnabled);
    } else {
      audioController.stopLoop();
    }
  }, [audioController, phase, presentationSoundEnabled]);

  useEffect(() => {
    if (phase !== "countdown") {
      audioController.stopOneShot("countdownTick");
      countdownSoundHandledRef.current = false;
      return;
    }

    if (!countdownSoundHandledRef.current) {
      countdownSoundHandledRef.current = true;
      if (presentationSoundEnabledRef.current) {
        void audioController.playOneShot("countdownTick", true);
      }
      return;
    }

    if (!presentationSoundEnabled) {
      audioController.stopOneShot("countdownTick");
    }
  }, [audioController, phase, presentationSoundEnabled]);

  useEffect(() => {
    onRevealCompleteRef.current = onRevealComplete;
  }, [onRevealComplete]);

  useEffect(() => {
    return () => {
      audioController.stopLoop();
      audioController.stopOneShot("countdownTick");
      if (revealHoldTimeoutRef.current !== null) {
        window.clearTimeout(revealHoldTimeoutRef.current);
      }
    };
  }, [audioController]);

  useEffect(() => {
    if (phase !== "reelStopping") {
      revealAttemptRef.current = null;
      revealCompletedRef.current = false;
      if (revealHoldTimeoutRef.current !== null) {
        window.clearTimeout(revealHoldTimeoutRef.current);
        revealHoldTimeoutRef.current = null;
      }
      setReelSettledDigits(0);
      return;
    }

    if (revealAttemptRef.current !== state.event.currentAttemptId) {
      revealAttemptRef.current = state.event.currentAttemptId ?? null;
      revealCompletedRef.current = false;
    }

    if (prefersReducedMotion) {
      setReelSettledDigits(4);
      audioController.stopLoop();
      if (!revealCompletedRef.current) {
        const finalSound = isGrandPrize ? "grandPrize" : "winnerReveal";
        void audioController.playOneShot(finalSound, presentationSoundEnabledRef.current);
      }
      if (revealHoldTimeoutRef.current !== null) {
        window.clearTimeout(revealHoldTimeoutRef.current);
      }
      revealHoldTimeoutRef.current = window.setTimeout(() => {
        revealHoldTimeoutRef.current = null;
        triggerRevealComplete();
      }, PRESENTATION_TIMING.reducedMotionCompleteMs);
      return () => {
        if (revealHoldTimeoutRef.current !== null) {
          window.clearTimeout(revealHoldTimeoutRef.current);
          revealHoldTimeoutRef.current = null;
        }
      };
    }

    setReelSettledDigits(0);
    const timers = PRESENTATION_TIMING.reelDigitStopsMs.map((delayMs, index) =>
      window.setTimeout(() => {
        setReelSettledDigits(index + 1);
        void audioController.playOneShot("digitStop", presentationSoundEnabledRef.current);

        if (index === PRESENTATION_TIMING.reelDigitStopsMs.length - 1) {
          audioController.stopLoop();
          void audioController.playOneShot(isGrandPrize ? "grandPrize" : "winnerReveal", presentationSoundEnabledRef.current);
          if (revealHoldTimeoutRef.current !== null) {
            window.clearTimeout(revealHoldTimeoutRef.current);
          }
          revealHoldTimeoutRef.current = window.setTimeout(() => {
            revealHoldTimeoutRef.current = null;
            triggerRevealComplete();
          }, Math.max(0, PRESENTATION_TIMING.reelCompleteMs - delayMs));
        }
      }, delayMs),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      if (revealHoldTimeoutRef.current !== null) {
        window.clearTimeout(revealHoldTimeoutRef.current);
        revealHoldTimeoutRef.current = null;
      }
    };
  }, [audioController, isGrandPrize, phase, prefersReducedMotion, state.event.currentAttemptId]);

  useEffect(() => {
    if (phase !== "countdown") {
      countdownAttemptRef.current = null;
      countdownAutoAdvanceScheduledRef.current = false;
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

  useEffect(() => {
    if (phase !== "countdown") {
      countdownAutoAdvanceScheduledRef.current = false;
      return;
    }

    if (countdownAutoAdvanceScheduledRef.current) {
      return;
    }

    countdownAutoAdvanceScheduledRef.current = true;
    const timer = window.setTimeout(
      () => {
        countdownAutoAdvanceScheduledRef.current = false;
        onStartDraw();
      },
      prefersReducedMotion ? PRESENTATION_TIMING.reducedMotionCountdownCompleteMs : PRESENTATION_TIMING.countdownCompleteMs,
    );

    return () => {
      window.clearTimeout(timer);
      countdownAutoAdvanceScheduledRef.current = false;
    };
  }, [onStartDraw, phase, prefersReducedMotion]);

  function triggerRevealComplete() {
    if (revealCompletedRef.current) {
      return;
    }

    revealCompletedRef.current = true;
    onRevealCompleteRef.current();
  }

  const finalReelReveal = phase === "reelStopping" && reelSettledDigits === 4;
  const celebrationActive = finalReelReveal || phase === "pendingWinner" || phase === "eventComplete";

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
          {renderPhaseCaption(phase, currentPrize?.name)}
        </section>
      </div>
      {phase !== "setup" && phase !== "eventComplete" ? (
        <div className="presentation-stage__controls">
          <PresentationControls
            phase={phase}
            pendingWinner={pendingWinner}
            isCommandInFlight={isCommandInFlight}
            onStartCountdown={onStartCountdown}
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
    return (
      <ReelDisplay
        code={pendingWinner?.code ?? null}
        settledDigits={settledDigits}
        isGrandPrize={isGrandPrize}
        celebrate={settledDigits === 4}
      />
    );
  }

  if (phase === "drawing") {
    return <ReelDisplay code={null} settledDigits={0} isGrandPrize={isGrandPrize} />;
  }

  return <ReelDisplay code={null} settledDigits={4} isGrandPrize={isGrandPrize} />;
}

function renderPhaseCaption(phase: EventPhase, currentPrizeName: string | undefined) {
  if (phase === "setup") {
    return <p className="presentation-stage-caption">Presentation is not active yet.</p>;
  }

  if (phase === "ready") {
    return <p className="presentation-stage-caption presentation-stage-caption--ready">Ready for {currentPrizeName ?? "the next prize"}</p>;
  }

  if (phase === "countdown") {
    return <p className="presentation-stage-caption">Get Ready</p>;
  }

  if (phase === "drawing") {
    return <p className="presentation-stage-caption">Drawing...</p>;
  }

  if (phase === "reelStopping") {
    return <p className="presentation-stage-caption">Winning Number</p>;
  }

  if (phase === "pendingWinner") {
    return <p className="presentation-stage-caption presentation-stage-caption--winner">Winning Number</p>;
  }

  if (phase === "eventComplete") {
    return <p className="presentation-stage-caption presentation-stage-caption--winner">Lucky Draw Complete</p>;
  }

  return null;
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