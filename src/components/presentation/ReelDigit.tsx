import type { CSSProperties } from "react";

export interface ReelDigitProps {
  digit: string;
  spinning: boolean;
  delayMs: number;
  isGrandPrize?: boolean;
  winner?: boolean;
}

export function ReelDigit({ digit, spinning, delayMs, isGrandPrize = false, winner = false }: ReelDigitProps) {
  return (
    <div
      className={[
        "reel-digit",
        spinning ? "reel-digit--spinning" : "reel-digit--stopped",
        isGrandPrize ? "reel-digit--grand" : "",
        winner ? "reel-digit--winner" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ "--reel-delay": `${delayMs}ms` } as CSSProperties}
      aria-label={spinning ? "Spinning reel" : `Digit ${digit}`}
    >
      {spinning ? (
        <div className="reel-digit__track" aria-hidden="true">
          {Array.from({ length: 30 }, (_, index) => String(index % 10)).map((value, index) => (
            <span key={`${value}-${index}`} className="reel-digit__frame">
              {value}
            </span>
          ))}
        </div>
      ) : (
        <strong className="reel-digit__value" data-testid="presentation-digit">
          {digit}
        </strong>
      )}
    </div>
  );
}