import { useEffect, useRef } from 'react';

/** Distância antes do fim da lista em que a próxima página já é pedida. */
const ROOT_MARGIN = '200px';

/**
 * Rolagem infinita (decisão 197): quando o marcador do fim da lista chega perto da tela,
 * pede a próxima página.
 */
export function useLoadMoreOnScroll({
  enabled,
  onLoadMore,
}: {
  enabled: boolean;
  onLoadMore: () => void;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const loadMore = useRef(onLoadMore);
  loadMore.current = onLoadMore;

  useEffect(() => {
    const node = sentinel.current;
    if (!enabled || !node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore.current();
      },
      { rootMargin: ROOT_MARGIN },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled]);

  return sentinel;
}
