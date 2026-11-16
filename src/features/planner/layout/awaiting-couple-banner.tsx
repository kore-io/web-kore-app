import { Alert, Button, useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { paths } from '../../../app/paths';
import { useAccessInvitationsControllerSendV1 } from '../../../shared/api/generated/access-invitations/access-invitations';
import {
  getMyWeddingsControllerDetailV1QueryKey,
  useMyWeddingsControllerDetailV1,
} from '../../../shared/api/generated/planner/planner';
import { InviteAnotherDialog } from '../my-weddings/wedding-detail-panel';
import { coupleInvitations, sentDay } from '../my-weddings/wedding-detail-texts';

/**
 * A faixa Aguardando o casal dentro do casamento (Colaboradora RN04; Penpot 17; Voz), lida
 * do GET /v1/me/weddings/{id} só quando o casamento aguarda o casal:
 * - pelo e-mail: "Enviamos o convite para {e-mail} em {dd/mm}." com Reenviar convite e
 *   Convidar outro e-mail (os mesmos do detalhe);
 * - pelo link: "O convite foi por link e vale até {dd/mm}." e "Ver o link para o casal", que
 *   abre o detalhe em Meus casamentos.
 */
export function AwaitingCoupleBanner({ weddingId }: { weddingId: string }) {
  const { t } = useTranslation('planner');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const detail = useMyWeddingsControllerDetailV1(weddingId, { query: { retry: false } });
  const send = useAccessInvitationsControllerSendV1();
  const [inviting, setInviting] = useState(false);
  if (!detail.data) return null;
  const { email, link } = coupleInvitations({ detail: detail.data });
  if (!email && !link) return null;
  const refresh = () =>
    void queryClient.invalidateQueries({
      queryKey: getMyWeddingsControllerDetailV1QueryKey(weddingId),
    });

  function resend(address: string) {
    send.mutate(
      { weddingId, data: { kind: 'couple', emails: [address] } },
      {
        onSuccess: () => {
          refresh();
          showToast({
            tone: 'success',
            message: t('myWeddings.detail.resent', { email: address }),
          });
        },
        onError: () => showToast({ tone: 'danger', message: t('myWeddings.detail.resendError') }),
      },
    );
  }

  return (
    <div className="kore-planner-wedding__awaiting">
      <Alert tone="info" title={t('weddingArea.awaiting.title')}>
        {email?.email && email.sentAt ? (
          <>
            <p className="kore-planner-wedding__awaiting-text">
              {t('weddingArea.awaiting.email', {
                email: email.email,
                date: sentDay({ at: email.sentAt, timezone: detail.data.timezone }),
              })}
            </p>
            <div className="kore-planner-wedding__awaiting-actions">
              <Button
                type="button"
                variant="secondary"
                disabled={send.isPending}
                onClick={() => resend(email.email ?? '')}
              >
                {t('myWeddings.detail.resend')}
              </Button>
              {/* Penpot 17: o segundo, como link sublinhado ao lado do Reenviar. */}
              <button
                type="button"
                className="kore-planner-wedding__awaiting-link"
                onClick={() => setInviting(true)}
              >
                {t('myWeddings.detail.inviteAnother')}
              </button>
            </div>
            <InviteAnotherDialog
              open={inviting}
              weddingId={weddingId}
              previousEmail={email.email}
              onClose={() => setInviting(false)}
              onSent={refresh}
            />
          </>
        ) : (
          link && (
            <>
              <p className="kore-planner-wedding__awaiting-text">
                {t('weddingArea.awaiting.link', {
                  date: sentDay({ at: link.expiresAt, timezone: detail.data.timezone }),
                })}
              </p>
              <Link
                className="kore-planner-wedding__awaiting-link"
                to={`${paths.plannerArea}?casamento=${encodeURIComponent(weddingId)}`}
              >
                {t('weddingArea.awaiting.seeLink')}
              </Link>
            </>
          )
        )}
      </Alert>
    </div>
  );
}
