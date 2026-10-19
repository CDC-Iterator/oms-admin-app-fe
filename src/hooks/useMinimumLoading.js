import { useEffect, useRef, useState } from "react";

/** True while `active`, and for at least `minMs` after it starts — so a fast request still shows its loader. */
export function useMinimumLoading(active, minMs = 600) {
  const [held, setHeld] = useState(active);
  const startedAt = useRef(0);

  useEffect(() => {
    if (active) {
      startedAt.current = Date.now();
      setHeld(true);
      return undefined;
    }
    const remaining = minMs - (Date.now() - startedAt.current);
    if (remaining <= 0) {
      setHeld(false);
      return undefined;
    }
    const timer = setTimeout(() => setHeld(false), remaining);
    return () => clearTimeout(timer);
  }, [active, minMs]);

  return active || held;
}
