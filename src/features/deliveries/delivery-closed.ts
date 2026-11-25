import type { TFunction } from 'i18next';
import type { MeMembershipResponse } from '../../shared/api/generated/model';
import type { Audience } from '../guests/hooks/use-active-wedding';
import { lifecycleView } from '../billing/lifecycle/lifecycle';

/**
 * Por que os envios estão fechados (Envios RN01; Data de saída do ar RN07), ou nulo:
 * - antes de publicar, e no pós-evento, como antes;
 * - na carência, como no pós-evento: ela vem sempre depois do casamento, e a API recusa os
 *   envios com o `DELIVERIES_CLOSED` de reason `post_event` (decisão 332, que revoga a 330);
 * - no expirado, `expired`; com mês pago à frente (caso B), `expired_paid_ahead` (331(1);
 *   `.prs/f3/pena-331.md`); no sem renovação, `expired_final` (314(3)).
 */
export type Closed =
  'not_published' | 'post_event' | 'expired' | 'expired_paid_ahead' | 'expired_final' | null;

export function deliveriesClosed({
  status,
  membership,
  now,
}: {
  /** O status do site, do Dashboard. */
  status: string;
  /** O lifecycle e as datas do /me, para o sem renovação. */
  membership: Pick<MeMembershipResponse, 'lifecycle' | 'eventDate' | 'timezone'> | undefined;
  now: Date;
}): Closed {
  if (status === 'published') return null;
  if (status === 'post_event' || status === 'grace') return 'post_event';
  if (status === 'expired') {
    const view = membership?.lifecycle
      ? lifecycleView({
          lifecycle: membership.lifecycle,
          eventDate: membership.eventDate,
          timezone: membership.timezone,
          now,
        })
      : null;
    if (view?.kind !== 'expired') return 'expired';
    if (view.variant === 'final') return 'expired_final';
    return view.variant === 'paidAhead' ? 'expired_paid_ahead' : 'expired';
  }
  return 'not_published';
}

/**
 * O texto dos envios fechados no expirado (RN07; 314(3); 331(1)), o mesmo na legenda de
 * Envios, no motivo do Enviar convites do Dashboard e no Toast do `409 SITE_EXPIRED`, pela
 * versão do perfil. Nulo fora do expirado.
 */
export function expiredClosedText({
  closed,
  audience,
  t,
}: {
  closed: Closed;
  audience: Audience;
  t: TFunction<'deliveries'>;
}): string | null {
  if (closed === 'expired') return t(`closed.expired.${audience}`);
  if (closed === 'expired_paid_ahead') return t(`closed.expiredPaidAhead.${audience}`);
  if (closed === 'expired_final') return t('closed.expiredFinal');
  return null;
}
