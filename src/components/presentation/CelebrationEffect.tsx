import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

export interface CelebrationEffectProps {
  active: boolean;
  enhanced: boolean;
  reducedMotion: boolean;
}

export function CelebrationEffect({ active, enhanced, reducedMotion }: CelebrationEffectProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 1800);
    return () => window.clearTimeout(timer);
  }, [active]);

  if (!visible) {
    return null;
  }

  if (reducedMotion) {
    return <div className={`celebration-effect celebration-effect--static${enhanced ? " celebration-effect--grand" : ""}`} data-testid="confetti-static" />;
  }

  return (
    <div className={`celebration-effect${enhanced ? " celebration-effect--grand" : ""}`} data-testid="confetti" aria-hidden="true">
      {Array.from({ length: enhanced ? 18 : 12 }, (_, index) => (
        <span key={index} className="celebration-effect__piece" style={{ "--piece-index": index } as CSSProperties} />
      ))}
    </div>
  );
}
