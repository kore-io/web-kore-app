import { useCallback, useEffect, useRef, useState } from 'react';

export interface HorizontalOverflow {
  /** O conteúdo passa da largura do quadro (o quadro rola). */
  scrolls: boolean;
  /** Há conteúdo escondido à esquerda (o quadro já rolou). */
  hiddenStart: boolean;
  /** Há conteúdo escondido à direita (o quadro ainda não chegou ao fim). */
  hiddenEnd: boolean;
}

const NONE: HorizontalOverflow = { scrolls: false, hiddenStart: false, hiddenEnd: false };

function measure(element: HTMLElement): HorizontalOverflow {
  const max = element.scrollWidth - element.clientWidth;
  // 1 px de folga para o arredondamento das larguras fracionárias.
  if (max <= 1) return NONE;
  return {
    scrolls: true,
    hiddenStart: element.scrollLeft > 1,
    hiddenEnd: element.scrollLeft < max - 1,
  };
}

function same(a: HorizontalOverflow, b: HorizontalOverflow) {
  return a.scrolls === b.scrolls && a.hiddenStart === b.hiddenStart && a.hiddenEnd === b.hiddenEnd;
}

/**
 * O mesmo hook da tabela de grupos da lib (`@kore-io/design`, decisão 348), que a lib não
 * exporta: o DataTable do app rola do mesmo jeito.
 * Acompanha a rolagem horizontal de um quadro: se ele rola e de que lado há conteúdo
 * escondido. Mede de novo quando o quadro ou o conteúdo muda de tamanho e a cada rolagem.
 * Sem `ResizeObserver` (testes, servidor), mede só na montagem e na rolagem.
 */
export function useHorizontalOverflow<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [overflow, setOverflow] = useState<HorizontalOverflow>(NONE);

  const update = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    const next = measure(element);
    setOverflow((current) => (same(current, next) ? current : next));
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    update();
    element.addEventListener('scroll', update, { passive: true });
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(update);
      observer.observe(element);
      for (const child of Array.from(element.children)) observer.observe(child);
    }
    return () => {
      element.removeEventListener('scroll', update);
      observer?.disconnect();
    };
  }, [update]);

  return { ref, overflow };
}
