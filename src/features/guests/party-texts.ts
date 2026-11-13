import type { TFunction } from 'i18next';
import { dayAndTimeIn } from '../../shared/date-texts';
import type {
  PartyCountsResponse,
  PartyListItemResponse,
  PartySummaryResponse,
} from '../../shared/api/generated/model';

type GuestsT = TFunction<'guests'>;

/**
 * Resumo do topo (RN13): "142 convidados em 58 grupos · 96 confirmados, 18 recusados e
 * 28 pendentes"; com 0, o plural ("0 recusados", decisão 199(2)).
 */
export function summaryText({ t, summary }: { t: GuestsT; summary: PartySummaryResponse }) {
  return t('summary.line', {
    guests: t('summary.guests', { count: summary.guests }),
    parties: t('summary.parties', { count: summary.parties }),
    confirmed: t('summary.confirmed', { count: summary.confirmed }),
    declined: t('summary.declined', { count: summary.declined }),
    pending: t('summary.pending', { count: summary.pending }),
  });
}

/**
 * Linha do contato (RN06 e RN13): "Célia Moreira · (19) 9****-3310"; sem contato, o 1º
 * convidado "· sem telefone ou e-mail"; contato só com e-mail, só o nome (decisão 198(e)).
 */
export function contactText({ t, party }: { t: GuestsT; party: PartyListItemResponse }) {
  const { contact, firstGuestName } = party;
  if (contact === null) return t('row.noContact', { name: firstGuestName ?? '' });
  const name = contact.name ?? '';
  return contact.phoneMasked === null
    ? name
    : t('row.contact', { name, phone: contact.phoneMasked });
}

/**
 * Coluna Respostas (decisão 198(f)): 1ª linha "nenhum confirmado" / "1 confirmado" /
 * "{n} confirmados"; 2ª linha "nenhum recusado ou pendente" com tudo zero, senão
 * "nenhum recusado" ou "{n} recusado(s)", mais os pendentes com nome e as vagas pendentes
 * que não são zero, separados por " · ".
 */
export function responsesText({ t, counts }: { t: GuestsT; counts: PartyCountsResponse }) {
  const namedPending = counts.pending - counts.pendingPlusOnes;
  const primary = t('row.confirmed', { count: counts.confirmed });
  if (counts.declined === 0 && counts.pending === 0) {
    return { primary, secondary: t('row.noneDeclinedOrPending') };
  }
  const parts = [
    counts.declined === 0 ? t('row.noneDeclined') : t('row.declined', { count: counts.declined }),
  ];
  if (namedPending > 0) parts.push(t('row.pending', { count: namedPending }));
  if (counts.pendingPlusOnes > 0) {
    parts.push(t('row.pendingPlusOnes', { count: counts.pendingPlusOnes }));
  }
  return { primary, secondary: parts.join(' · ') };
}

/**
 * Respondido em (Prazo RN07): "12/09 às 20h14" e "por Célia" ou "alterada por Ana"; hora cheia sem minutos
 * ("21/06 às 9h", regra das datas curtas em listas da Voz), no fuso do casamento.
 */
export function respondedAtText({
  t,
  party,
  timezone,
}: {
  t: GuestsT;
  party: PartyListItemResponse;
  /** O fuso do casamento, como o .xlsx (decisão 246). */
  timezone: string | null;
}) {
  if (party.respondedAt === null) return null;
  const { date, time } = dayAndTimeIn({ at: party.respondedAt, timezone });
  // Quem respondeu (Prazo RN07): "por Célia" (o grupo, quem assinou) ou "alterada por Ana"
  // (o casal ou a cerimonialista, quem alterou); sem nome, só a data.
  const last = party.lastResponse;
  const secondary =
    last?.actor === 'couple' && last.actorName
      ? t('row.changedBy', { name: last.actorName })
      : last?.actor === 'party' && last.signedByName
        ? t('row.respondedBy', { name: last.signedByName })
        : undefined;
  return { primary: t('row.respondedAt', { date, time }), secondary };
}
