import { Alert, Badge, type BadgeTone } from '@kore-io/design';
import type { TFunction } from 'i18next';
import { Check, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useMatch } from 'react-router';
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

/**
 * A ação do casal pelo estado (RN06; 293(5); 314(1)): Adiar a data na carência, Renovar no
 * expirado, Voltar ao ar no caso B (os três levam a mudar a data) e Exportar os convidados no
 * sem renovação. A colaboradora não tem ação (Papéis RN03).
 */
export function lifecycleAction({ view, audience }: { view: LifecycleView; audience: Audience }): {
  label: 'postpone' | 'renew' | 'backOnline' | 'exportGuests';
  to: 'endDate' | 'export';
} | null {
  if (audience !== 'couple') return null;
  if (view.kind === 'grace') return { label: 'postpone', to: 'endDate' };
  if (view.kind !== 'expired') return null;
  if (view.variant === 'final') return { label: 'exportGuests', to: 'export' };
  return { label: view.variant === 'paidAhead' ? 'backOnline' : 'renew', to: 'endDate' };
}

/** O rótulo da ação, nos textos do ciclo de vida e da tela da data. */
export function lifecycleActionLabel({
  label,
  t,
}: {
  label: 'postpone' | 'renew' | 'backOnline' | 'exportGuests';
  t: TFunction<'billing'>;
}): string {
  return label === 'backOnline' ? t('endDate.backOnline') : t(`lifecycle.${label}`);
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
  // Na própria tela de mudar a data, a faixa fica sem o link (Penpot 21, A6 caso B).
  const onEndDate = useMatch({ path: paths.billingEndDate, end: true }) !== null;
  // O bloqueio e a exclusão agendada têm as faixas deles, que substituem estas (329(4); 316(8)).
  if (source.lifecycle.blocked || source.lifecycle.deletionScheduledFor) return null;
  const view = lifecycleView({ ...source, now });
  const text = lifecycleText({ view, audience, now, t });
  if (!text) return null;
  // Na A7 (o sem renovação, na tela da data) a faixa fica oculta: a tela já é o destino (314(5)).
  if (onEndDate && view.kind === 'expired' && view.variant === 'final') return null;
  // A ação do casal; na própria tela da data, sem o link para ela (Penpot 21, A6).
  const action = lifecycleAction({ view, audience });
  const link = action && !(action.to === 'endDate' && onEndDate) ? action : null;
  return (
    <Alert
      tone={view.kind === 'grace' ? 'warning' : 'danger'}
      title={text}
      className="kore-lifecycle-banner"
    >
      {link && (
        <Link
          to={link.to === 'endDate' ? paths.billingEndDate : paths.guestExport}
          className="kore-lifecycle-banner__link"
        >
          {lifecycleActionLabel({ label: link.label, t })}
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
