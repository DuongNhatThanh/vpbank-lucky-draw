export interface PresentationHeaderProps {
  eventName: string;
  onReturnToOperator: () => void;
}

export function PresentationHeader({ eventName, onReturnToOperator }: PresentationHeaderProps) {
  return (
    <header className="presentation-header">
      <div className="presentation-brand">
        <img src="/vpbank-logo.webp" alt="VPBank" className="presentation-brand__logo" />
        <div className="presentation-brand__copy">
          <p className="presentation-brand__event">{eventName}</p>
          <p className="presentation-brand__subtitle">Lucky Draw</p>
        </div>
      </div>
      <button type="button" className="button button--secondary presentation-header__button" onClick={onReturnToOperator}>
        Return to Operator
      </button>
    </header>
  );
}
