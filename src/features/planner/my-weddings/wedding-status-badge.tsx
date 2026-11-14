import { Badge, type BadgeTone } from '@kore-io/design';
import { useTranslation } from 'react-i18next';
import type { MyWeddingItemResponse } from '../../../shared/api/generated/model';

/** As cores do Status no Penpot 03: Publicado em verde, Pós-evento em azul, os de espera em amarelo. */
const TONES: Record<MyWeddingItemResponse['status'], BadgeTone> = {
  awaiting_couple: 'warning',
  draft: 'neutral',
  published: 'success',
  post_event: 'info',
  grace: 'warning',
  expired: 'neutral',
};

/** O status do casamento em Meus casamentos (RN02; o bloqueado mostra o de sempre, 84). */
export function WeddingStatusBadge({ status }: { status: MyWeddingItemResponse['status'] }) {
  const { t } = useTranslation('planner');
  return <Badge tone={TONES[status]}>{t(`myWeddings.status.${status}`)}</Badge>;
}
