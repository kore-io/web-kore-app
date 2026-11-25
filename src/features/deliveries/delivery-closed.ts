import type { MeMembershipResponse } from '../../shared/api/generated/model';
import { lifecycleView } from '../billing/lifecycle/lifecycle';

/**
 * Por que os envios estão fechados (Envios RN01; Data de saída do ar RN07), ou nulo:
 * - antes de publicar, e no pós-evento, como antes;
 * - na carência, como no pós-evento: ela vem sempre depois do casamento, e a API recusa os
 *   envios com o `DELIVERIES_CLOSED` de reason `post_event` (decisão 332, que revoga a 330);
 * - no expirado, `expired`, e no sem renovação, `expired_final` (314(3)).
 */
export type Closed = 'not_published' | 'post_event' | 'expired' | 'expired_final' | null;

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
    return view?.kind === 'expired' && view.variant === 'final' ? 'expired_final' : 'expired';
  }
  return 'not_published';
}
