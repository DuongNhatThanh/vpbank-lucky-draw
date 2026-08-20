import { useCallback, useEffect, useState, type RefObject } from "react";

export interface FullscreenState {
  supported: boolean;
  active: boolean;
  error: string | null;
  toggle: () => Promise<void>;
}

export function useFullscreen(targetRef: RefObject<HTMLElement | null>): FullscreenState {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const available = typeof document !== "undefined" && document.fullscreenEnabled === true;
    setSupported(available);
    setActive(typeof document !== "undefined" && document.fullscreenElement !== null);

    if (!available) {
      return;
    }

    const handleFullscreenChange = () => {
      setActive(document.fullscreenElement !== null);
      setError(null);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggle = useCallback(async () => {
    if (!supported) {
      setError("Fullscreen is not available in this browser.");
      return;
    }

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        const target = targetRef.current;
        if (!target) {
          setError("The presentation surface is not ready for fullscreen.");
          return;
        }

        await target.requestFullscreen();
      }
    } catch {
      setError("Fullscreen was not enabled. The presentation will continue normally.");
    }
  }, [supported, targetRef]);

  return { supported, active, error, toggle };
}
