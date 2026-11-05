import { useEffect, useState } from 'react';

/**
 * Segundos que faltam até `until` (epoch em ms), atualizando a cada segundo; `null` sem
 * prazo. Arredonda para cima: com 0,2 s faltando, ainda mostra 1.
 */
export function useCountdown({ until }: { until: number | null }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (until === null) return;
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [until]);

  if (until === null) return null;
  return Math.max(0, Math.ceil((until - now) / 1000));
}
