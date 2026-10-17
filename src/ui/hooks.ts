import { useEffect, useState } from 'react';

/** true, если экран достаточно широкий для двухколоночной раскладки. */
export function useIsWide(minPx = 960): boolean {
  const q = `(min-width: ${minPx}px)`;
  const [wide, setWide] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(q).matches : true));
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return wide;
}
