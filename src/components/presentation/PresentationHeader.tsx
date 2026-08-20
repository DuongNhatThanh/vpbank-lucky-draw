export interface PresentationHeaderProps {
  eventName: string;
  onReturnToOperator: () => void;
  fullscreenSupported: boolean;
  fullscreenActive: boolean;
  fullscreenError: string | null;
  onToggleFullscreen: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export function PresentationHeader({
  eventName,
  onReturnToOperator,
  fullscreenSupported,
  fullscreenActive,
  fullscreenError,
  onToggleFullscreen,
  soundEnabled,
  onToggleSound,
}: PresentationHeaderProps) {
  return (
    <header className="presentation-header">
      <div className="presentation-brand">
        <img src="/vpbank-logo.webp" alt="VPBank" className="presentation-brand__logo" />
        <div className="presentation-brand__copy">
          <p className="presentation-brand__event">{eventName}</p>
          <p className="presentation-brand__subtitle">Lucky Draw</p>
        </div>
      </div>
      <div className="presentation-toolbar" aria-label="Presentation controls">
        {fullscreenSupported ? (
          <button type="button" className="button button--secondary presentation-toolbar__button" onClick={onToggleFullscreen}>
            {fullscreenActive ? "Exit Fullscreen" : "Enter Fullscreen"}
          </button>
        ) : null}
        <button type="button" className="button button--secondary presentation-toolbar__button" onClick={onToggleSound}>
          {soundEnabled ? "Sound On" : "Sound Off"}
        </button>
        <button type="button" className="button button--secondary presentation-toolbar__button" onClick={onReturnToOperator}>
          Return to Operator
        </button>
      </div>
      {fullscreenError ? <p className="presentation-header__error" role="status">{fullscreenError}</p> : null}
    </header>
  );
}
