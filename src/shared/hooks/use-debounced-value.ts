import { useEffect, useState } from 'react';

/** O valor depois de `delayMs` sem mudar (ex.: checar o endereço só quando a pessoa para). */
export function useDebouncedValue<T>({ value, delayMs }: { value: T; delayMs: number }) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
