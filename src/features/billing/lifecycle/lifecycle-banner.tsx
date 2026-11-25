import { Alert, Badge, type BadgeTone } from '@kore-io/design';
import type { TFunction } from 'i18next';
import { Check, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useAreaPaths } from '../../../app/area';
import type { MeLifecycleResponse } from '../../../shared/api/generated/model';
import { oneDot, shortDayMonth } from '../../../shared/date-texts';
import type { Audience } from '../../guests/hooks/use-active-wedding';
import { siteStatus } from '../../site/site-texts';
import { lifecycleView, type LifecycleView } from './lifecycle';

/** O texto da faixa (e do cartão Status) pelo estado e pela versão (RN06; Pena; 293; 314). */
export function lifecycleText({
  view,
  audience,
  now,
  t,
}: {
  view: LifecycleView;
  audience: Audience;
  now: Date;
  t: TFunction<'billing'>;
}): string | null {
  if (view.kind === 'grace') {
    return oneDot(
      t(`lifecycle.banner.grace.${audience}`, {
        date: shortDayMonth({ day: view.graceUntil, now }),
      }),
    );
  }
  if (view.kind === 'expired') {
    return oneDot(
      t(`lifecycle.banner.${view.variant}.${audience}`, {
        date: shortDayMonth({ day: view.since, now }),
        paidThrough: view.paidThrough ? shortDayMonth({ day: view.paidThrough, now }) : '',
      }),
    );
  }
  return null;
}

/** "Vence em N dias" e, no último dia, "Último dia no ar" (RN06; 231 P2). */
export function graceLabel({ daysLeft, t }: { daysLeft: number; t: TFunction<'billing'> }) {
  return daysLeft <= 1
    ? t('lifecycle.badge.lastDay')
    : t('lifecycle.badge.daysLeft', { count: daysLeft });
}

interface LifecycleSource {
  lifecycle: MeLifecycleResponse;
  eventDate: string | null;
  timezone: string | null;
}

/**
 * A faixa fixa do ciclo de vida no topo das telas do casamento (RN06; Penpot 09, A8 "Faixa
 * / Expirado"): Atenção na carência, Erro no expirado, nas versões do casal e da
 * colaboradora. O caso B do casal leva a Voltar ao ar (E10; 333(2)); o Adiar a data e o
 * Renovar entram no E11; o sem renovação do casal leva a Exportar os convidados. Com o casamento bloqueado, a faixa do bloqueio a substitui
 * (329(4)).
 */
export function LifecycleBanner({
  source,
  audience,
}: {
  source: LifecycleSource;
  audience: Audience;
}) {
  const { t } = useTranslation('billing');
  const paths = useAreaPaths();
  const now = new Date();
  if (source.lifecycle.blocked) return null;
  const view = lifecycleView({ ...source, now });
  const text = lifecycleText({ view, audience, now, t });
  if (!text) return null;
  const exportLink = view.kind === 'expired' && view.variant === 'final' && audience === 'couple';
  // O Voltar ao ar do caso B entra no E10 (333(2)); o Adiar a data e o Renovar, no E11.
  const backOnline =
    view.kind === 'expired' && view.variant === 'paidAhead' && audience === 'couple';
  return (
    <Alert
      tone={view.kind === 'grace' ? 'warning' : 'danger'}
      title={text}
      className="kore-lifecycle-banner"
    >
      {backOnline && (
        <Link to={paths.billingEndDate} className="kore-lifecycle-banner__link">
          {t('endDate.backOnline')}
        </Link>
      )}
      {exportLink && (
        <Link to={paths.guestExport} className="kore-lifecycle-banner__link">
          {t('lifecycle.exportGuests')}
        </Link>
      )}
    </Alert>
  );
}

/**
 * O selo de status do site (Topbar e cartão Status; Dashboard RN07; Data de saída RN06;
 * decisão 90), pelo `lifecycle` do /me (329(3)): Publicado em verde com o ✓, Rascunho com o
 * documento, "Vence em N dias" em amarelo, Pós-evento em azul e Expirado em cinza na Topbar
 * (`expiredTone` muda o tom no cartão, em vermelho, como no Penpot 03).
 */
export function LifecycleBadge({
  source,
  expiredTone = 'neutral',
  className,
}: {
  source: LifecycleSource;
  expiredTone?: BadgeTone;
  className?: string;
}) {
  const { t } = useTranslation('billing');
  const { t: tSite } = useTranslation('site');
  const view = lifecycleView({ ...source, now: new Date() });
  const props = className ? { className } : {};
  if (view.kind === 'grace') {
    return (
      <Badge tone="warning" {...props}>
        {graceLabel({ daysLeft: view.daysLeft, t })}
      </Badge>
    );
  }
  const known = siteStatus(source.lifecycle.status);
  if (!known) return null;
  if (known === 'published') {
    return (
      <Badge tone="success" icon={<Check strokeWidth={2.4} />} {...props}>
        {tSite(`status.${known}`)}
      </Badge>
    );
  }
  const tone: BadgeTone =
    known === 'post_event' ? 'info' : known === 'expired' ? expiredTone : 'neutral';
  return (
    <Badge tone={tone} {...(known === 'draft' && { icon: <FileText /> })} {...props}>
      {tSite(`status.${known}`)}
    </Badge>
  );
}
