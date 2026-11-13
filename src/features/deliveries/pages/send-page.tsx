import { Spinner } from '@kore-io/design';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { useDashboardControllerGetV1 } from '../../../shared/api/generated/rsvp/rsvp';
import { LoadErrorNotice } from '../../../shared/components/load-error';
import { useActiveWedding, type Audience } from '../../guests/hooks/use-active-wedding';
import type { DeliveryKind } from '../delivery-texts';
import { ChannelStep } from './channel-step';
import { GroupsStep } from './groups-step';
import { QueueStep } from './queue-step';

export type Step = 'grupos' | 'canal' | 'fila';

/** Por que os envios estão fechados (Envios RN01), ou nulo. */
export type Closed = 'not_published' | 'post_event' | null;

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
  if (dashboard.isError) return <LoadErrorNotice onRetry={() => void dashboard.refetch()} />;
  if (!dashboard.data) {
    return (
      <div className="kore-send__loading">
        <Spinner label={t('title')} />
      </div>
    );
  }
  const status = dashboard.data.site.status;
  const closed: Closed =
    status === 'post_event' ? 'post_event' : status === 'published' ? null : 'not_published';
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

/** A legenda de antes de publicar (RN01; A2), nas duas vozes; o casal ganha o link. */
export function ClosedNotice({ audience, closed }: { audience: Audience; closed: Closed }) {
  const { t } = useTranslation('deliveries');
  if (closed !== 'not_published') return null;
  return (
    <p className="kore-send__closed" id="kore-send-closed">
      {/* O link Publicar o site volta com a tela paga do front da F3 (decisão 243). */}
      {t(`closed.notPublished.${audience}`)}
    </p>
  );
}
