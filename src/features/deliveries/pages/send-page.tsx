import { Spinner } from '@kore-io/design';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { useAreaPaths } from '../../../app/area';
import { useDashboardControllerGetV1 } from '../../../shared/api/generated/rsvp/rsvp';
import { LoadErrorNotice } from '../../../shared/components/load-error';
import { useActiveWedding, type Audience } from '../../guests/hooks/use-active-wedding';
import { deliveriesClosed, expiredClosedText, type Closed } from '../delivery-closed';
import type { DeliveryKind } from '../delivery-texts';
import { useMeControllerMeV1 } from '../../../shared/api/generated/me/me';
import { ChannelStep } from './channel-step';
import { GroupsStep } from './groups-step';
import { QueueStep } from './queue-step';

export type Step = 'grupos' | 'canal' | 'fila';

export type { Closed } from '../delivery-closed';

/**
 * Uma aba de envio (Envios RN01 a RN08; Penpot, página 07; decisão 235): Grupos → Canal e
 * mensagem → Fila de envio, no mesmo caminho, com ?etapa=canal e ?etapa=fila.
 */
export function SendPage({ kind }: { kind: DeliveryKind }) {
  const { weddingId, audience } = useActiveWedding();
  if (!weddingId) return null;
  return <Send key={kind} weddingId={weddingId} audience={audience} kind={kind} />;
}

function Send({
  weddingId,
  audience,
  kind,
}: {
  weddingId: string;
  audience: Audience;
  kind: DeliveryKind;
}) {
  const { t } = useTranslation('deliveries');
  const [search] = useSearchParams();
  const dashboard = useDashboardControllerGetV1(weddingId);
  const { data: me } = useMeControllerMeV1();
  if (dashboard.isError) return <LoadErrorNotice onRetry={() => void dashboard.refetch()} />;
  if (!dashboard.data) {
    return (
      <div className="kore-send__loading">
        <Spinner label={t('title')} />
      </div>
    );
  }
  // A carência segue o pós-evento (332); o expirado fecha, com o sem renovação à parte (RN07; 314(3)).
  const closed: Closed = deliveriesClosed({
    status: dashboard.data.site.status,
    membership: me?.memberships.find((item) => item.weddingId === weddingId),
    now: new Date(),
  });
  const asked = (search.get('etapa') as Step | null) ?? 'grupos';
  // Fechado, só a etapa dos grupos, com a legenda (RN01).
  const step: Step = closed ? 'grupos' : asked;
  const props = { weddingId, audience, kind, closed };
  return (
    <>
      <Stepper step={step} />
      {step === 'grupos' ? (
        <GroupsStep {...props} />
      ) : step === 'canal' ? (
        <ChannelStep {...props} />
      ) : (
        <QueueStep {...props} />
      )}
    </>
  );
}

const STEPS: { key: Step; label: 'steps.groups' | 'steps.channel' | 'steps.queue' }[] = [
  { key: 'grupos', label: 'steps.groups' },
  { key: 'canal', label: 'steps.channel' },
  { key: 'fila', label: 'steps.queue' },
];

/** As etapas (Penpot, página 07): 1 Grupos · 2 Canal e mensagem · 3 Fila de envio. */
function Stepper({ step }: { step: Step }) {
  const { t } = useTranslation('deliveries');
  const current = STEPS.findIndex((item) => item.key === step);
  return (
    <ol className="kore-send__steps" aria-label={t('steps.label')}>
      {STEPS.map((item, index) => (
        <li
          key={item.key}
          className="kore-send__step"
          data-state={index < current ? 'done' : index === current ? 'current' : 'next'}
          {...(index === current && { 'aria-current': 'step' })}
        >
          <span className="kore-send__step-number" aria-hidden="true">
            {index + 1}
          </span>
          <span className="kore-send__step-label">{t(item.label)}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * A legenda dos envios fechados (Envios RN01, A2; Data de saída RN07, A8, Penpot 07), nas duas
 * vozes; só o casal ganha o link: antes de publicar, Publicar o site; no caso B, Voltar ao ar
 * (331(1); pena-331); no expirado comum, Renovar (RN07; E11); no sem renovação, Exportar os
 * convidados (314(3)).
 */
export function ClosedNotice({ audience, closed }: { audience: Audience; closed: Closed }) {
  const { t } = useTranslation('deliveries');
  const area = useAreaPaths();
  const expiredText = expiredClosedText({ closed, audience, t });
  if (expiredText) {
    const link =
      audience !== 'couple'
        ? null
        : closed === 'expired_paid_ahead'
          ? { to: area.billingEndDate, label: t('closed.backOnline') }
          : closed === 'expired_final'
            ? { to: area.guestExport, label: t('closed.exportGuests') }
            : closed === 'expired'
              ? { to: area.billingEndDate, label: t('closed.renew') }
              : null;
    return (
      <p className="kore-send__closed" id="kore-send-closed">
        {expiredText}
        {link && (
          <>
            {' '}
            <Link to={link.to}>{link.label}</Link>
          </>
        )}
      </p>
    );
  }
  if (closed !== 'not_published') return null;
  return (
    <p className="kore-send__closed" id="kore-send-closed">
      {t(`closed.notPublished.${audience}`)}
      {/* Só o casal publica (Publicar e pagar RN01; decisão 243(c)). */}
      {audience === 'couple' && (
        <>
          {' '}
          <Link to={area.billingPublish}>{t('closed.publish')}</Link>
        </>
      )}
    </p>
  );
}
