import { useEffect, useRef } from 'react';

export function useGameLoop(callback) {
  const rafRef      = useRef(null);
  const lastTimeRef = useRef(null);
  const cbRef       = useRef(callback);
  cbRef.current = callback; // always up-to-date without restarting the loop

  useEffect(() => {
    const loop = (ts) => {
      if (lastTimeRef.current === null) lastTimeRef.current = ts;
      const delta = ts - lastTimeRef.current;
      lastTimeRef.current = ts;
      cbRef.current(delta, ts);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = null;
    };
  }, []); // start once, never restart
}
