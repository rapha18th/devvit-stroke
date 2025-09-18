import { useEffect, useRef, useState } from 'react';

export function useCountdown(seconds: number, onFinish?: () => void) {
  const [remaining, setRemaining] = useState(seconds);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (seconds <= 0) return;
    setRemaining(seconds);
    timerRef.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          onFinish?.();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [seconds, onFinish]);

  return remaining;
}
