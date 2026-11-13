import { useState } from 'react';
import type { DeliveryChannel, DeliveryKind } from '../delivery-texts';

/** Até 200 grupos por envio, por fila e por arquivo de QR (Envios RN10). */
export const DELIVERY_LIMIT = 200;

interface Stored {
  ids: string[];
  channel: DeliveryChannel;
}

const keyOf = ({ weddingId, kind }: { weddingId: string; kind: DeliveryKind }) =>
  `kore.deliveries.${weddingId}.${kind}`;

function read(key: string): Stored {
  try {
    const raw = window.sessionStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as Partial<Stored>) : {};
    return {
      ids: Array.isArray(parsed.ids) ? parsed.ids.filter((id) => typeof id === 'string') : [],
      channel: parsed.channel ?? 'whatsapp',
    };
  } catch {
    return { ids: [], channel: 'whatsapp' };
  }
}

function write(key: string, value: Stored) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sem armazenamento, a seleção vale só nesta tela.
  }
}

/**
 * Os grupos marcados e o canal de um tipo de envio (Envios RN04, RN05, RN07): ficam no
 * `sessionStorage` do aparelho, só como conveniência entre as etapas e para "continuar
 * depois"; a fila não é guardada no servidor. No formato da seleção da lista de grupos.
 */
export function useDeliverySelection({
  weddingId,
  kind,
  visibleIds,
}: {
  weddingId: string;
  kind: DeliveryKind;
  /** Os grupos carregados na lista (o "marcar todos" marca esses). */
  visibleIds: string[];
}) {
  const key = keyOf({ weddingId, kind });
  const [state, setState] = useState<Stored>(() => read(key));
  const selected = new Set(state.ids);
  const visible = visibleIds.filter((id) => selected.has(id));
  const allSelected = visibleIds.length > 0 && visible.length === visibleIds.length;

  function update(next: Stored) {
    setState(next);
    write(key, next);
  }

  return {
    /** Todos os marcados, também os que não estão na página carregada. */
    ids: state.ids,
    channel: state.channel,
    count: state.ids.length,
    isSelected: (id: string) => selected.has(id),
    allSelected,
    someSelected: visible.length > 0 && !allSelected,
    toggle: (id: string) =>
      update({
        ...state,
        ids: selected.has(id) ? state.ids.filter((item) => item !== id) : [...state.ids, id],
      }),
    toggleAll: () =>
      update({
        ...state,
        ids: allSelected
          ? state.ids.filter((id) => !visibleIds.includes(id))
          : [...new Set([...state.ids, ...visibleIds])],
      }),
    clear: () => update({ ...state, ids: [] }),
    setIds: (ids: string[]) => update({ ...state, ids }),
    setChannel: (channel: DeliveryChannel) => update({ ...state, channel }),
  };
}

/** Marca os grupos de um tipo de fora (ex.: o Lembrar pendentes da lista de grupos, A9). */
export function presetDeliverySelection({
  weddingId,
  kind,
  ids,
}: {
  weddingId: string;
  kind: DeliveryKind;
  ids: string[];
}) {
  const key = keyOf({ weddingId, kind });
  write(key, { ...read(key), ids });
}
