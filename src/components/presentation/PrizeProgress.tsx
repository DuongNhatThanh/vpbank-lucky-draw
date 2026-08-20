import type { PrizeProgress } from "../../state/selectors";
import type { Prize } from "../../domain/types";

export interface PrizeProgressProps {
  prize: Prize | undefined;
  progress: PrizeProgress;
}

export function PrizeProgress({ prize, progress }: PrizeProgressProps) {
  return (
    <section className={`presentation-prize${prize?.isGrandPrize ? " presentation-prize--grand" : ""}`} aria-label="Prize progress">
      <p className="presentation-prize__eyebrow">Current Prize</p>
      <h1 className="presentation-prize__name">{prize?.name ?? "Prize unavailable"}</h1>
      <div className="presentation-prize__progress">{progress.label}</div>
    </section>
  );
}
