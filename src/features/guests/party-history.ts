import type { TFunction } from 'i18next';
import type { PartyHistoryEntryResponse } from '../../shared/api/generated/model';
import { dayAndTimeIn } from '../../shared/date-texts';

type GuestsT = TFunction<'guests'>;

/**
 * "12/09 às 20h14"; a hora cheia sem minutos ("21/06 às 9h"), como nas listas (Voz). No fuso
 * do casamento (decisão 248).
 */
export function historyAt({
  t,
  at,
  timezone,
}: {
  t: GuestsT;
  at: string;
  timezone: string | null;
}): string {
  const { date, time } = dayAndTimeIn({ at, timezone });
  return t('panel.history.at', { date, time });
}

/** "3 confirmados" · "2 confirmados, 1 recusado" · "3 recusados": a parte com zero sai. */
function totals({
  t,
  confirmed = 0,
  declined = 0,
}: {
  t: GuestsT;
  confirmed?: number | undefined;
  declined?: number | undefined;
}) {
  return [
    confirmed > 0 && t('panel.history.confirmed', { count: confirmed }),
    declined > 0 && t('panel.history.declined', { count: declined }),
  ]
    .filter(Boolean)
    .join(', ');
}

/**
 * Uma linha do Histórico do grupo (Prazo e respostas RN05), sem ponto final: os envios por
 * canal, o convite aberto, a resposta do grupo com quem assinou e os totais, e a alteração
 * do casal com o convidado e a resposta. Nunca a restrição alimentar.
 */
export function historyLine({
  t,
  entry,
  plusOneLabel,
}: {
  t: GuestsT;
  entry: PartyHistoryEntryResponse;
  /** O nome da vaga sem nome ("Acompanhante"). */
  plusOneLabel: string;
}): string {
  if (entry.kind === 'viewed') return t('panel.history.viewed');
  if (entry.kind !== 'response') {
    return t(`panel.history.${entry.kind}.${entry.channel ?? 'whatsapp'}` as const);
  }
  if (entry.actor === 'couple' && entry.guest) {
    return t('panel.history.changed', {
      name: entry.actorName ?? '',
      guest: entry.guest.name ?? plusOneLabel,
      answer:
        entry.guest.status === 'confirmed' ? t('panel.history.goes') : t('panel.history.notGoes'),
    });
  }
  const summary = totals({ t, confirmed: entry.confirmed, declined: entry.declined });
  return entry.signedBy
    ? t('panel.history.respondedBy', { name: entry.signedBy, totals: summary })
    : t('panel.history.respondedByParty', { totals: summary });
}
