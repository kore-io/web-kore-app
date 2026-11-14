import { Button, Dialog, Input, useToast } from '@kore-io/design';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CoupleInvitationResponse } from '../../../shared/api/generated/model';

/**
 * O bloco Link para o casal no detalhe (RN09; Voz, Link do casal; Penpot 03): o link que o
 * casal já tem (o mesmo, guardado cifrado, só para quem o gerou), Copiar link, Compartilhar
 * no WhatsApp, Gerar novo link e Cancelar link com a confirmação. Vencido: "Este link
 * venceu." e só o Gerar novo link.
 */
export function CoupleLinkBlock({
  link,
  busy,
  onRegenerate,
  onCancel,
}: {
  link: CoupleInvitationResponse;
  busy: boolean;
  onRegenerate: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation('planner');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const fieldId = useId();
  const expired = link.state === 'expired' || !link.url;

  function copy(url: string) {
    void navigator.clipboard
      .writeText(url)
      .then(() => showToast({ tone: 'success', message: t('myWeddings.detail.link.copied') }))
      .catch(() =>
        showToast({
          tone: 'danger',
          message: `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
        }),
      );
  }

  return (
    <section className="kore-wedding-detail__block" aria-labelledby={`${fieldId}-title`}>
      <h3 id={`${fieldId}-title`} className="kore-wedding-detail__block-title">
        {t('myWeddings.detail.link.title')}
      </h3>
      {expired ? (
        <>
          <p className="kore-wedding-detail__block-text">{t('myWeddings.detail.link.expired')}</p>
          <Button type="button" variant="secondary" disabled={busy} onClick={onRegenerate}>
            {t('myWeddings.detail.link.regenerate')}
          </Button>
        </>
      ) : (
        <>
          <p className="kore-wedding-detail__block-text">
            {t('myWeddings.detail.link.description')}
          </p>
          <div className="kore-wedding-detail__link-row">
            <Input
              id={fieldId}
              aria-label={t('myWeddings.detail.link.field')}
              readOnly
              value={(link.url ?? '').replace(/^https?:\/\//, '')}
            />
            <Button type="button" variant="secondary" onClick={() => copy(link.url ?? '')}>
              {t('myWeddings.detail.link.copy')}
            </Button>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              window.open(
                `https://wa.me/?text=${encodeURIComponent(
                  t('myWeddings.detail.link.whatsappMessage', { link: link.url ?? '' }),
                )}`,
                '_blank',
                'noopener',
              )
            }
          >
            {t('myWeddings.detail.link.whatsapp')}
          </Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={onRegenerate}>
            {t('myWeddings.detail.link.regenerate')}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setConfirming(true)}>
            {t('myWeddings.detail.link.cancel')}
          </Button>
          <Dialog
            open={confirming}
            onOpenChange={setConfirming}
            role="alertdialog"
            title={t('myWeddings.detail.link.cancelDialog.title')}
            description={t('myWeddings.detail.link.cancelDialog.description')}
            actions={
              <>
                <Button variant="secondary" onClick={() => setConfirming(false)}>
                  {t('myWeddings.detail.link.cancelDialog.back')}
                </Button>
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() => {
                    setConfirming(false);
                    onCancel();
                  }}
                >
                  {t('myWeddings.detail.link.cancelDialog.confirm')}
                </Button>
              </>
            }
          />
        </>
      )}
    </section>
  );
}
