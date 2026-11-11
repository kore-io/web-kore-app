import { useState } from 'react';

/**
 * Seleção múltipla da lista (RN13): os ids marcados entre os grupos carregados; o
 * "marcar todos" marca os carregados (as ações em lote vêm com as tags e a lixeira).
 */
export function usePartySelection({ ids }: { ids: string[] }) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  // Só conta o que está na lista (um filtro novo tira os que saíram).
  const visible = ids.filter((id) => selected.has(id));
  const allSelected = ids.length > 0 && visible.length === ids.length;

  return {
    count: visible.length,
    isSelected: (id: string) => selected.has(id),
    allSelected,
    someSelected: visible.length > 0 && !allSelected,
    toggle: (id: string) =>
      setSelected((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    toggleAll: () => setSelected(allSelected ? new Set() : new Set(ids)),
    clear: () => setSelected(new Set()),
  };
}
