import type { Participant } from "../../domain/types";

export interface WinnerRevealProps {
  code: string;
  participant: Participant | undefined;
  isGrandPrize?: boolean;
}

export function WinnerReveal({ code, participant, isGrandPrize = false }: WinnerRevealProps) {
  return (
    <section className={`winner-reveal${isGrandPrize ? " winner-reveal--grand" : ""}`} aria-label="Winning result">
      <div className="winner-reveal__code" aria-label={`Winning code ${code}`}>
        {( /^\d{4}$/.test(code) ? code.split("") : [] ).map((digit, index) => (
          <strong key={`${digit}-${index}`} className="winner-reveal__digit" data-testid="presentation-digit">
            {digit}
          </strong>
        ))}
      </div>
      {participant?.name ? <p className="winner-reveal__name">{participant.name}</p> : null}
    </section>
  );
}
