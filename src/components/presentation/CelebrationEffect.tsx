import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

export interface CelebrationEffectProps {
  active: boolean;
  enhanced: boolean;
  reducedMotion: boolean;
}

const PARTICLES_PER_SIDE = 12;

export function CelebrationEffect({ active, enhanced, reducedMotion }: CelebrationEffectProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), enhanced ? 2400 : 2000);
    return () => window.clearTimeout(timer);
  }, [active, enhanced]);

  if (!visible) {
    return null;
  }

  if (reducedMotion) {
    return (
      <div
        className={`celebration-effect celebration-effect--static${enhanced ? " celebration-effect--grand" : ""}`}
        data-testid="celebration-static"
        aria-hidden="true"
      />
    );
  }

  const count = enhanced ? PARTICLES_PER_SIDE + 4 : PARTICLES_PER_SIDE;

  return (
    <div
      className={`celebration-effect celebration-effect--fireworks${enhanced ? " celebration-effect--grand" : ""}`}
      data-testid="celebration-fireworks"
      aria-hidden="true"
    >
      <FireworkBurst side="left" count={count} />
      <FireworkBurst side="right" count={count} />
    </div>
  );
}

function FireworkBurst({ side, count }: { side: "left" | "right"; count: number }) {
  return (
    <div className={`fireworks fireworks--${side}`} data-testid={`fireworks-${side}`} aria-hidden="true">
      <span className="fireworks__core" />
      {Array.from({ length: count }, (_, index) => (
        <span
          key={`${side}-${index}`}
          className="fireworks__particle"
          style={
            {
              "--particle-index": index,
              "--particle-angle": `${(360 / count) * index}deg`,
              "--particle-distance": `${120 + (index % 4) * 26}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}