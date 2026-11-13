import { Button, Spinner, useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadFile } from '../../../shared/api/download-file';
import type { QrCodesBodyFormat } from '../../../shared/api/generated/model';
import { getPartiesControllerListV1InfiniteQueryKey } from '../../../shared/api/generated/parties/parties';
import {
  getDashboardControllerGetV1QueryKey,
  getDeliveriesControllerGetQueueV1QueryKey,
  getQrCodesControllerCreateV1Url,
  useDeliveriesControllerGetQueueV1,
} from '../../../shared/api/generated/rsvp/rsvp';
import { apiErrorCode } from '../../../shared/api/http-client';
import { LoadErrorNotice } from '../../../shared/components/load-error';
import { DELIVERY_LIMIT, useDeliverySelection } from '../hooks/use-delivery-selection';

/**
 * A fila do QR code (Envios RN09; Penpot A6 "QR code" e "QR code baixado"): sem cartões,
 * a lista dos grupos marcados e um botão só. Com 1 grupo, a imagem (PNG); com vários, o
 * PDF para impressão, um QR por página. O servidor gera o arquivo e marca o envio do
 * convite de todos os grupos, com o canal QR code, na mesma chamada.
 */
export function QrStep({ weddingId }: { weddingId: string }) {
  const { t } = useTranslation('deliveries');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const selection = useDeliverySelection({ weddingId, kind: 'invite', visibleIds: [] });
  const ids = selection.ids.slice(0, DELIVERY_LIMIT);
  // A leitura da fila dá o nome e o contato mascarado de cada grupo (e tira a lixeira).
  const queue = useDeliveriesControllerGetQueueV1(
    weddingId,
    { kind: 'invite', partyIds: ids.join(',') },
    { query: { enabled: ids.length > 0, refetchOnWindowFocus: false } },
  );
  const [downloading, setDownloading] = useState(false);

  if (queue.isError) return <LoadErrorNotice onRetry={() => void queue.refetch()} />;
  if (!queue.data) {
    return (
      <div className="kore-send__loading">
        <Spinner label={t('title')} />
      </div>
    );
  }
  const items = queue.data.items;
  const format: QrCodesBodyFormat = items.length === 1 ? 'png' : 'pdf';

  async function download() {
    if (downloading || items.length === 0) return;
    setDownloading(true);
    try {
      await downloadFile({
        path: getQrCodesControllerCreateV1Url(weddingId),
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ partyIds: items.map((item) => item.id), format }),
        },
      });
      showToast({ tone: 'success', message: t('qr.downloaded', { count: items.length }) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getDashboardControllerGetV1QueryKey(weddingId) }),
        queryClient.invalidateQueries({
          queryKey: getPartiesControllerListV1InfiniteQueryKey(weddingId),
        }),
        queryClient.invalidateQueries({
          queryKey: getDeliveriesControllerGetQueueV1QueryKey(weddingId),
        }),
      ]);
    } catch (error) {
      // Fechou no meio (despublicado ou depois do casamento): o painel relê o status (RN01).
      if (apiErrorCode({ error }) === 'DELIVERIES_CLOSED') {
        void queryClient.invalidateQueries({
          queryKey: getDashboardControllerGetV1QueryKey(weddingId),
        });
      }
      showToast({
        tone: 'danger',
        message: `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
      });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="kore-send kore-send--qr">
      <ul className="kore-send__qr-list">
        {items.map((item) => {
          const contact = [
            item.contact?.name,
            item.contact?.phoneMasked ?? item.contact?.emailMasked,
          ]
            .filter(Boolean)
            .join(' · ');
          return (
            <li key={item.id} className="kore-send__qr-item">
              <p className="kore-send__card-name">{item.name}</p>
              {contact && <p className="kore-send__card-contact">{contact}</p>}
            </li>
          );
        })}
      </ul>
      <div className="kore-send__bar">
        <Button disabled={downloading || items.length === 0} onClick={() => void download()}>
          {t(`qr.${format}`)}
        </Button>
      </div>
    </div>
  );
}
