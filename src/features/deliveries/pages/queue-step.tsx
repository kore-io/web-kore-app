import { Alert, Badge, Button, Progress, Spinner, useToast } from '@kore-io/design';
import { Check, TriangleAlert } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import type { DeliveryQueueItemResponse } from '../../../shared/api/generated/model';
import {
  deliveriesControllerMarkV1,
  getDashboardControllerGetV1QueryKey,
  useDeliveriesControllerGetQueueV1,
} from '../../../shared/api/generated/rsvp/rsvp';
import { getPartiesControllerListV1InfiniteQueryKey } from '../../../shared/api/generated/parties/parties';
import { LoadErrorNotice } from '../../../shared/components/load-error';
import type { Audience } from '../../guests/hooks/use-active-wedding';
import { deliveryStatusText, sentAtOf, type DeliveryKind } from '../delivery-texts';
import { DELIVERY_LIMIT, useDeliverySelection } from '../hooks/use-delivery-selection';
import { QrStep } from './qr-step';
import type { Closed } from './send-page';
import { useAreaPaths } from '../../../app/area';

type Sent = Record<string, { at: string; channel: 'whatsapp' | 'email' | 'link' }>;

/**
 * A Fila de envio (Envios RN07; Penpot A6): o aviso acima da fila do WhatsApp, o contador
 * "{n} de {total} enviados", um cartão por grupo com o contato e o botão do canal, e
 * "Parar e continuar depois". O clique abre a URL pronta na hora (o bloqueio de popup do
 * iOS) e marca o envio em paralelo, com `keepalive`; o Kore não sabe se a mensagem saiu.
 */
export function QueueStep(props: {
  weddingId: string;
  audience: Audience;
  kind: DeliveryKind;
  closed: Closed;
}) {
  const { channel } = useDeliverySelection({
    weddingId: props.weddingId,
    kind: props.kind,
    visibleIds: [],
  });
  // O QR code tem a fila própria, sem cartões, e só no convite (RN09).
  if (props.kind === 'invite' && channel === 'qr') return <QrStep weddingId={props.weddingId} />;
  return <ChannelQueue {...props} />;
}

function ChannelQueue({
  weddingId,
  audience,
  kind,
}: {
  weddingId: string;
  audience: Audience;
  kind: DeliveryKind;
  closed: Closed;
}) {
  const area = useAreaPaths();
  const { t } = useTranslation('deliveries');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const selection = useDeliverySelection({ weddingId, kind, visibleIds: [] });
  const channel = selection.channel === 'qr' ? 'whatsapp' : selection.channel;
  const ids = selection.ids.slice(0, DELIVERY_LIMIT);
  const queue = useDeliveriesControllerGetQueueV1(
    weddingId,
    { kind, partyIds: ids.join(',') },
    {
      query: {
        enabled: ids.length > 0,
        // Relê ao abrir a fila (a mensagem pode ter mudado), e não ao voltar à aba.
        refetchOnMount: 'always',
        staleTime: Infinity,
        refetchOnWindowFocus: false,
      },
    },
  );
  const [sent, setSent] = useState<Sent>({});

  if (queue.isError) return <LoadErrorNotice onRetry={() => void queue.refetch()} />;
  if (!queue.data) {
    return (
      <div className="kore-send__loading">
        <Spinner label={t('title')} />
      </div>
    );
  }
  const items = queue.data.items;
  const skipped = queue.data.skippedPartyIds.length;
  const doneCount = items.filter((item) => sent[item.id] || sentAtOf({ kind, item })).length;

  function mark(item: DeliveryQueueItemResponse) {
    const at = new Date().toISOString();
    setSent((current) => ({ ...current, [item.id]: { at, channel } }));
    // Em paralelo ao canal, sem esperar: o keepalive sobrevive à troca de aba (RN07).
    void deliveriesControllerMarkV1(
      weddingId,
      { kind, channel, partyIds: [item.id] },
      { keepalive: true },
    )
      .then(() => {
        void queryClient.invalidateQueries({
          queryKey: getDashboardControllerGetV1QueryKey(weddingId),
        });
        void queryClient.invalidateQueries({
          queryKey: getPartiesControllerListV1InfiniteQueryKey(weddingId),
        });
      })
      .catch(() =>
        showToast({
          tone: 'danger',
          message: `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
        }),
      );
  }

  function send(item: DeliveryQueueItemResponse) {
    if (channel === 'link') {
      void navigator.clipboard.writeText(item.copyText).then(() => {
        showToast({ tone: 'success', message: t('queue.copied') });
        mark(item);
      });
      return;
    }
    const url = channel === 'whatsapp' ? item.whatsappUrl : item.mailtoUrl;
    if (!url) return;
    // Síncrono no clique: o Safari do iOS bloqueia a aba aberta depois de um await.
    window.open(url, '_blank', 'noopener');
    mark(item);
  }

  return (
    <div className="kore-send kore-send--queue">
      {channel === 'whatsapp' && <Alert tone="info">{t('queue.notice')}</Alert>}
      {skipped > 0 && (
        <p className="kore-send__note">{t('reminder.outside', { count: skipped })}</p>
      )}
      <Progress
        value={doneCount}
        max={Math.max(items.length, 1)}
        label={t('queue.counter', { sent: doneCount, total: items.length })}
      />
      <ul className="kore-send__queue">
        {items.map((item) => {
          const local = sent[item.id];
          const status = deliveryStatusText({
            t,
            at: local?.at ?? sentAtOf({ kind, item }),
            channel: local?.channel ?? item.lastChannel,
            now: new Date(),
          });
          const done = Boolean(local ?? sentAtOf({ kind, item }));
          const missing =
            (channel === 'whatsapp' && !item.whatsappUrl) ||
            (channel === 'email' && !item.mailtoUrl);
          const contact = [
            item.contact?.name,
            channel === 'email' ? item.contact?.emailMasked : item.contact?.phoneMasked,
          ]
            .filter(Boolean)
            .join(' · ');
          return (
            <li key={item.id} className="kore-send__card">
              <div className="kore-send__card-text">
                <p className="kore-send__card-name">{item.name}</p>
                {done && status ? (
                  <p className="kore-send__card-status">{status}</p>
                ) : (
                  contact && !missing && <p className="kore-send__card-contact">{contact}</p>
                )}
                {missing && (
                  <p className="kore-send__card-missing">
                    <TriangleAlert aria-hidden="true" />
                    {t(`queue.${channel === 'email' ? 'noEmail' : 'noPhone'}.${audience}`)}
                  </p>
                )}
              </div>
              <div className="kore-send__card-actions">
                {missing ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void navigate(area.guestPartyEdit({ partyId: item.id }))}
                  >
                    {t('queue.editParty')}
                  </Button>
                ) : done ? (
                  <>
                    <Badge tone="success" icon={<Check strokeWidth={2.4} />}>
                      {t('queue.sent')}
                    </Badge>
                    <Button variant="secondary" size="sm" onClick={() => send(item)}>
                      {t('queue.again')}
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => send(item)}>
                    {t(`queue.open.${channel}`)}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="kore-send__bar">
        <Button variant="secondary" onClick={() => setSearch({})}>
          {t('queue.stop')}
        </Button>
      </div>
    </div>
  );
}
