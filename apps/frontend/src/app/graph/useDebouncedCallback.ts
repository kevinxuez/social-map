import { useRef, useCallback } from 'react';

export function useDebouncedCallback<T extends (...args:any[])=>void>(fn:T, delay=400) {
  const t = useRef<NodeJS.Timeout>();
  return useCallback((...args:Parameters<T>) => {
    if (t.current) {
      clearTimeout(t.current);
    }
    t.current = setTimeout(()=>fn(...args), delay);
  }, [fn, delay]);
}
