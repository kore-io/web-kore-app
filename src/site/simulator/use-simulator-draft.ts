import { useEffect, useState } from 'react';
import {
  emptyDraft,
  loadDraft,
  saveDraft,
  SITE_DRAFT_KEY,
  type SimulatorDraft,
} from '../../shared/simulator/draft';

/** As UTM e a origem da chegada ao /simule (Simule RN05 e RN10). */
export function arrivalFrom(search: string): Pick<SimulatorDraft, 'origin' | 'utm'> {
  const params = new URLSearchParams(search);
  const utm: SimulatorDraft['utm'] = {};
  for (const [param, key] of [
    ['utm_source', 'source'],
    ['utm_medium', 'medium'],
    ['utm_campaign', 'campaign'],
  ] as const) {
    const value = params.get(param)?.slice(0, 100);
    if (value) utm[key] = value;
  }
  return { origin: params.get('origem') === 'site' ? 'made_with_kore' : 'simulator', utm };
}

/**
 * O rascunho do simulador na aba: começa pelo guardado no navegador (válido e no prazo,
 * para o Retomar) ou do zero no passo 1 (decisão 226(3)), e é guardado a cada mudança, com
 * o `savedAt` novo (os 7 dias contam da última mudança, RN05).
 */
export function useSimulatorDraft({ search }: { search: string }) {
  const [stored] = useState(() => loadDraft({ key: SITE_DRAFT_KEY, now: new Date() }));
  const [resuming, setResuming] = useState(() => stored !== null && stored.step !== 'start');
  const [draft, setDraft] = useState<SimulatorDraft>(
    () => stored ?? { ...emptyDraft({ now: new Date(), ...arrivalFrom(search) }), step: 'names' },
  );

  useEffect(() => {
    if (resuming) return;
    saveDraft({ key: SITE_DRAFT_KEY, draft });
  }, [draft, resuming]);

  return {
    draft,
    resuming,
    update: (change: Partial<SimulatorDraft>) =>
      setDraft((current) => ({ ...current, ...change, savedAt: new Date().toISOString() })),
    resume: () => setResuming(false),
    restart: () => {
      setResuming(false);
      setDraft({ ...emptyDraft({ now: new Date(), ...arrivalFrom(search) }), step: 'names' });
    },
  };
}
