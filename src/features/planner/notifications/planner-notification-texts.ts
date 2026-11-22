import type { TFunction } from 'i18next';
import type { NotificationResponse } from '../../../shared/api/generated/model';
import { responseGroups } from '../../notifications/notification-shape';
import { coupleName } from '../my-weddings/my-weddings-filters';

/** Os tipos da central da cerimonialista na F6 (Notificações da cerimonialista RN01). */
export const PLANNER_TYPES = ['rsvp', 'wedding_published', 'membership_removed'] as const;
export type PlannerType = (typeof PLANNER_TYPES)[number];

/** O nome que a API grava no lugar do grupo apagado a pedido do titular (decisão 253(3)). */
export const REMOVED_PARTY_NAME = 'Grupo removido';

/**
 * A data do item (RN05; decisão 302(1)), sempre numérica, no fuso do aparelho: "26/09 às
 * 9h12", "21/06 às 9h" na hora cheia e o ano só quando não é o corrente, "26/09/2025 às
 * 9h12". Sem "hoje" nem "ontem" (padrão das listas densas da Voz).
 */
export function plannerNotificationDate({
  t,
  at,
  now,
}: {
  t: TFunction<'dashboard'>;
  at: string;
  now: Date;
}): string {
  const date = new Date(at);
  const two = (value: number) => String(value).padStart(2, '0');
  const time =
    date.getMinutes() === 0
      ? `${date.getHours()}h`
      : `${date.getHours()}h${two(date.getMinutes())}`;
  const day = `${two(date.getDate())}/${two(date.getMonth() + 1)}`;
  const year = date.getFullYear() === now.getFullYear() ? '' : `/${date.getFullYear()}`;
  return t('activity.on', { date: `${day}${year}`, time });
}

export function isPlannerType(type: string): type is PlannerType {
  return (PLANNER_TYPES as readonly string[]).includes(type);
}

/**
 * O item que a central desenha: os 3 tipos dela; o `rsvp` só com grupos de resposta (a API
 * grava outros formatos em outros tipos, que chegam com a F3).
 */
export function isPlannerItem(item: NotificationResponse): boolean {
  if (!isPlannerType(item.type)) return false;
  return item.type !== 'rsvp' || responseGroups(item.payload) !== null;
}

/**
 * O título do item (RN05; decisão 300(1); Penpot 13), sem ponto final: "Família Moreira
 * respondeu em Ana e Marcos", "2 grupos responderam em Ana e Marcos", "Um grupo removido
 * respondeu em Ana e Marcos", "Site de Ana e Marcos foi publicado" e "Sua colaboração em
 * Priscila e Davi foi encerrada". Os nomes do casal vêm de `partnerNames`.
 */
export function plannerNotificationTitle({
  t,
  item,
}: {
  t: TFunction<'planner'>;
  item: NotificationResponse;
}): string {
  const couple = coupleName({ partnerNames: item.partnerNames });
  if (item.type === 'wedding_published') return t('notifications.items.published', { couple });
  if (item.type === 'membership_removed') return t('notifications.items.removed', { couple });
  const [first] = responseGroups(item.payload) ?? [];
  if (item.count <= 1 && first) {
    return first.name === REMOVED_PARTY_NAME
      ? t('notifications.items.rsvpRemovedGroup', { couple })
      : t('notifications.items.rsvpOne', { name: first.name, couple });
  }
  return t('notifications.items.rsvpMany', { count: item.count, couple });
}
