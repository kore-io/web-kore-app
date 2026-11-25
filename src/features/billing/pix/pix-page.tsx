import { Alert, Button, Input, PageHeader, Spinner, useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useAreaPaths } from '../../../app/area';
import { usePaymentsControllerBillingV1 } from '../../../shared/api/generated/billing/billing';
import {
  getMeControllerMeV1QueryKey,
  useMeControllerMeV1,
} from '../../../shared/api/generated/me/me';
import type { PendingPaymentDto } from '../../../shared/api/generated/model';
import { LoadErrorNotice } from '../../../shared/components/load-error';
import { Panel } from '../../../shared/components/panel';
import { dayMonthTimeIn } from '../../../shared/date-texts';
import { formatCents } from '../../../shared/money';
import { useActiveWedding } from '../../guests/hooks/use-active-wedding';
import type { PublishLocationState } from '../publish/publish-page';
import { CONFIRM_POLL_MS } from '../publish/use-publish-payment';

/**
 * Pagar com Pix (`…/cobranca/pix`; Publicar e pagar RN03, RN07, RN11 e RN13; Penpot 21, A3
 * "Pix aguardando" e "Pix vencido"). O copia e cola e a validade vêm do `pendingPayment` do
 * GET …/billing, que a tela consulta a cada 5 s até a confirmação (316(4)). O QR é desenhado
 * no navegador a partir do copia e cola (316(5)). O site só vai ao ar na confirmação (RN04).
 */
export function PixPage() {
  const { weddingId, role } = useActiveWedding();
  const paths = useAreaPaths();
  if (!weddingId) return null;
  // Só o casal paga: a colaboradora fica no Publicar, na versão dela (decisão 323).
  if (role !== 'owner') return <Navigate to={paths.billingPublish} replace />;
  return <Pix weddingId={weddingId} />;
}

/** O pendente de Pix da publicação (o de extensão é da tela da data, no E11). */
function pixPending(pending: PendingPaymentDto | null | undefined) {
  return pending?.kind === 'publication' && pending.method === 'pix' ? pending : null;
}

function Pix({ weddingId }: { weddingId: string }) {
  const { t } = useTranslation('billing');
  const { showToast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const paths = useAreaPaths();
  const location = useLocation();
  const { endDate } = (location.state ?? {}) as PublishLocationState;
  const { data: me } = useMeControllerMeV1();
  const timezone = me?.memberships.find((item) => item.weddingId === weddingId)?.timezone ?? null;
  const billing = usePaymentsControllerBillingV1(weddingId, {
    query: { refetchInterval: CONFIRM_POLL_MS },
  });
  // O pendente que a tela já mostrou: quando some sem o site publicado, o Pix venceu
  // (a reconciliação o cancela, RN11).
  const [shown, setShown] = useState<PendingPaymentDto | null>(null);
  const pending = pixPending(billing.data?.pendingPayment);
  // O pendente de agora (o dueAt pode mudar); o último visto, quando ele some.
  if (pending && (pending.paymentId !== shown?.paymentId || pending.dueAt !== shown.dueAt)) {
    setShown(pending);
  }
  const published = billing.data?.status === 'published';

  const done = useRef(false);
  useEffect(() => {
    if (!published || done.current) return;
    done.current = true;
    void queryClient.invalidateQueries({ queryKey: getMeControllerMeV1QueryKey() });
    showToast({ tone: 'success', message: t('publish.toast.confirmed') });
    void navigate(paths.dashboard);
  }, [published, queryClient, showToast, t, navigate, paths.dashboard]);

  if (billing.isError) return <LoadErrorNotice onRetry={() => void billing.refetch()} />;
  // O billing do cache pode ser de antes do POST (sem o pendente): decide só com o de agora.
  if (!billing.data || published || (!shown && !billing.isFetchedAfterMount)) {
    return (
      <div className="kore-pix__loading">
        <Spinner label={t('pix.loading')} />
      </div>
    );
  }
  // Sem pendente que a tela tenha mostrado: não há Pix para pagar; o Publicar.
  if (!shown) return <Navigate to={paths.billingPublish} replace />;

  const now = new Date();
  const expired = !pending || (shown.dueAt !== null && new Date(shown.dueAt) <= now);
  /** Volta ao Publicar preenchido, com a cotação nova (decisão 324). */
  const backToPublish = (method: 'pix' | 'card') => {
    const state: PublishLocationState = {
      method,
      // A data do pendente (o billing traz desde o #213; 324(3)); a da navegação, se faltar.
      ...((shown.endDate ?? endDate) !== undefined && { endDate: shown.endDate ?? endDate }),
      // Troca o pendente que o servidor ainda tem (RN07); o já cancelado não precisa.
      ...(pending && { replacesPaymentId: pending.paymentId }),
    };
    void navigate(paths.billingPublish, { state });
  };

  return (
    <div className="kore-pix">
      <PageHeader title={t('pix.title')} />
      <Panel gap="md" className="kore-pix__panel">
        <p className="kore-pix__amount">{formatCents({ cents: shown.amountCents })}</p>
        {expired ? (
          <>
            <Alert tone="danger" role="alert" title={t('pix.expired')} />
            <Button className="kore-pix__new" onClick={() => backToPublish('pix')}>
              {t('pix.newPix')}
            </Button>
          </>
        ) : (
          <PixCode pending={shown} timezone={timezone} now={now} />
        )}
        <Button variant="ghost" className="kore-pix__card" onClick={() => backToPublish('card')}>
          {t('pix.payWithCard')}
        </Button>
      </Panel>
    </div>
  );
}

/** O QR, o copia e cola com o Copiar código, a espera e a validade (Penpot "Pix aguardando"). */
function PixCode({
  pending,
  timezone,
  now,
}: {
  pending: PendingPaymentDto;
  timezone: string | null;
  now: Date;
}) {
  const { t } = useTranslation('billing');
  const { showToast } = useToast();
  const instructionId = useId();
  const code = pending.pixCopyPaste ?? '';
  return (
    <>
      <p id={instructionId} className="kore-pix__instruction">
        {t('pix.instruction')}
      </p>
      <PixQr code={code} label={t('pix.qrAlt')} />
      <div className="kore-pix__copy">
        <Input
          readOnly
          value={code}
          aria-labelledby={instructionId}
          className="kore-pix__code"
          onFocus={(event) => event.target.select()}
        />
        <Button
          variant="secondary"
          onClick={() => {
            void navigator.clipboard
              .writeText(code)
              .then(() => showToast({ tone: 'success', message: t('pix.copied') }));
          }}
        >
          {t('pix.copy')}
        </Button>
      </div>
      <div className="kore-pix__waiting">
        <Spinner label={t('pix.waiting')} />
        <span aria-hidden="true">{t('pix.waiting')}</span>
      </div>
      {pending.dueAt !== null && (
        <p className="kore-pix__caption">
          {t('pix.dueAt', { date: dayMonthTimeIn({ at: pending.dueAt, timezone, now }) })}
        </p>
      )}
      <p className="kore-pix__caption">{t('pix.effect')}</p>
    </>
  );
}

/** O QR Code do copia e cola, desenhado no navegador (316(5)); nenhuma imagem é guardada. */
function PixQr({ code, label }: { code: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const current = useRef(code);
  useEffect(() => {
    current.current = code;
    if (!code) return;
    void QRCode.toDataURL(code, { margin: 1, width: 400 }).then((url) => {
      if (current.current === code) setSrc(url);
    });
  }, [code]);
  return (
    <div className="kore-pix__qr">
      {src !== null && <img src={src} alt={label} className="kore-pix__qr-image" />}
    </div>
  );
}
