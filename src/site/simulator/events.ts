import { simulatorEventsControllerRecordV1 } from '../../shared/api/generated/product-events/product-events';
import type { SimulatorEventBodyName } from '../../shared/api/generated/model';

const SENT_KEY = 'kore.simulatorEvents';

/**
 * As métricas anônimas do funil (Simule RN11): só os 5 nomes, sem nada mais; cada um uma
 * vez por aba (marca no `sessionStorage`). Falha no envio é ignorada.
 */
export function recordSimulatorEvent(name: SimulatorEventBodyName): void {
  try {
    const sent = JSON.parse(window.sessionStorage.getItem(SENT_KEY) ?? '[]') as string[];
    if (sent.includes(name)) return;
    window.sessionStorage.setItem(SENT_KEY, JSON.stringify([...sent, name]));
  } catch {
    // Sem sessionStorage, manda mesmo assim.
  }
  simulatorEventsControllerRecordV1({ name }).catch(() => undefined);
}
