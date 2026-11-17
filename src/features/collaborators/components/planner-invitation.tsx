import { Alert, Button, Dialog, Input, useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useAccessInvitationsControllerCancelV1,
  useAccessInvitationsControllerSendV1,
} from '../../../shared/api/generated/access-invitations/access-invitations';
import { useMeControllerMeV1 } from '../../../shared/api/generated/me/me';
import { getWeddingMembersControllerListV1QueryKey } from '../../../shared/api/generated/memberships/memberships';
import type { PendingInvitationResponse } from '../../../shared/api/generated/model';
import { useSiteControllerGetV1 } from '../../../shared/api/generated/site/site';
import { ApiError, apiErrorCode } from '../../../shared/api/http-client';
import { FormField } from '../../../shared/components/form-field';
import { isValidEmail } from '../../access/email';
import { cardDate } from '../collaborators-texts';

/**
 * Os status em que o site está no ar, como o `live` da API (publicado, depois do evento e
 * carência): o aviso da C7-6 só faz sentido com o site aberto.
 */
const ONLINE = new Set(['published', 'post_event', 'grace']);

function useRefreshMembers({ weddingId }: { weddingId: string }) {
  const queryClient = useQueryClient();
  return () =>
    void queryClient.invalidateQueries({
      queryKey: getWeddingMembersControllerListV1QueryKey(weddingId),
    });
}

/**
 * O Convidar cerimonialista do casal (Convites de acesso RN02; Papéis RN02; decisões 276 e
 * 277): aparece só quando o casamento não tem cerimonialista nem convite pendente (Penpot 24).
 */
export function InvitePlanner({ weddingId }: { weddingId: string }) {
  const { t } = useTranslation('collaborators');
  const [open, setOpen] = useState(false);
  return (
    <>
      <p className="kore-collaborators__empty">{t('couple.invite.empty')}</p>
      <Button
        type="button"
        variant="secondary"
        className="kore-collaborators__invite"
        onClick={() => setOpen(true)}
      >
        {t('couple.invite.open')}
      </Button>
      <InvitePlannerDialog open={open} weddingId={weddingId} onClose={() => setOpen(false)} />
    </>
  );
}

function InvitePlannerDialog({
  open,
  weddingId,
  onClose,
}: {
  open: boolean;
  weddingId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation('collaborators');
  const { showToast } = useToast();
  const refresh = useRefreshMembers({ weddingId });
  const send = useAccessInvitationsControllerSendV1();
  const me = useMeControllerMeV1();
  const site = useSiteControllerGetV1(weddingId);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const formId = 'kore-invite-planner';
  // O aviso da C7-6 (decisão 277): o site no ar e a assinatura não ocultada pelo casal. Sem
  // cerimonialista, o Switch não existe (plannerCredit nulo) e a assinatura sai ao aceitar.
  const credit = site.data?.plannerCredit;
  const showNotice =
    ONLINE.has(site.data?.status ?? '') && (credit == null || credit.showPlannerCredit);

  function close() {
    setEmail('');
    setError(undefined);
    onClose();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim();
    if (!isValidEmail({ email: address })) {
      setError(t('couple.invite.invalidEmail'));
      return;
    }
    // O próprio e-mail só no app: a API não barra no kind planner (decisão 277).
    if (me.data && address.toLowerCase() === me.data.user.email.toLowerCase()) {
      setError(t('couple.invite.ownEmail'));
      return;
    }
    send.mutate(
      { weddingId, data: { kind: 'planner', emails: [address] } },
      {
        onSuccess: () => {
          refresh();
          close();
          showToast({ tone: 'success', message: t('couple.invite.sent', { email: address }) });
        },
        onError: (failure) => {
          if (failure instanceof ApiError && failure.status === 400) {
            setError(t('couple.invite.invalidEmail'));
            return;
          }
          if (apiErrorCode({ error: failure }) === 'PLANNER_ALREADY') {
            // Outra pessoa do casal convidou antes: fecha e relê a lista.
            refresh();
            close();
            showToast({ tone: 'danger', message: t('couple.invite.plannerAlready') });
            return;
          }
          showToast({ tone: 'danger', message: t('couple.invite.sendError') });
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && close()}
      role="dialog"
      title={t('couple.invite.dialog.title')}
      description={t('couple.invite.dialog.description')}
      actions={
        <>
          <Button variant="secondary" onClick={close}>
            {t('couple.invite.dialog.cancel')}
          </Button>
          <Button type="submit" form={formId} disabled={send.isPending}>
            {t('couple.invite.dialog.submit')}
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={submit} className="kore-collaborators__form">
        <FormField
          label={t('couple.invite.dialog.email')}
          {...(error && { hint: error, hintTone: 'danger' as const })}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="email"
              autoComplete="email"
              placeholder={t('couple.invite.dialog.placeholder')}
              aria-describedby={describedBy}
              invalid={invalid}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError(undefined);
              }}
            />
          )}
        </FormField>
        {showNotice && <Alert tone="info">{t('couple.invite.dialog.publishedNotice')}</Alert>}
      </form>
    </Dialog>
  );
}

/**
 * O convite de cerimonialista pendente (decisões 276(3) e 277): o e-mail, "vale até {dd/mm}"
 * (com o ano quando não é o atual) ou "O convite venceu.", com Reenviar convite e Cancelar
 * convite (sem confirmação: cancelar não tira ninguém de dentro).
 */
export function PendingPlannerInvitation({
  weddingId,
  invitation,
  timezone,
  now = new Date(),
}: {
  weddingId: string;
  invitation: PendingInvitationResponse;
  timezone: string | null;
  now?: Date;
}) {
  const { t } = useTranslation('collaborators');
  const { showToast } = useToast();
  const refresh = useRefreshMembers({ weddingId });
  const send = useAccessInvitationsControllerSendV1();
  const cancel = useAccessInvitationsControllerCancelV1();
  const email = invitation.email ?? '';
  const expired = new Date(invitation.expiresAt).getTime() <= now.getTime();
  const busy = send.isPending || cancel.isPending;

  /** Aceito ou cancelado em outra aba: o aviso e a lista relida. */
  function failed({ error, message }: { error: unknown; message: string }) {
    const code = apiErrorCode({ error });
    if (code === 'NOT_PENDING' || code === 'INVITATION_NOT_FOUND') {
      refresh();
      showToast({ tone: 'danger', message: t('couple.invite.notPending') });
      return;
    }
    showToast({ tone: 'danger', message });
  }

  function resend() {
    send.mutate(
      { weddingId, data: { kind: 'planner', emails: [email] } },
      {
        onSuccess: () => {
          refresh();
          showToast({ tone: 'success', message: t('couple.invite.resent', { email }) });
        },
        onError: (error) => failed({ error, message: t('couple.invite.resendError') }),
      },
    );
  }

  function cancelInvitation() {
    cancel.mutate(
      { weddingId, id: invitation.id },
      {
        onSuccess: () => {
          refresh();
          showToast({ tone: 'success', message: t('couple.invite.canceled') });
        },
        onError: (error) => failed({ error, message: t('couple.invite.cancelError') }),
      },
    );
  }

  return (
    <div className="kore-collaborators__pending">
      <div className="kore-collaborators__who">
        <span className="kore-collaborators__name">{email}</span>
        <span className="kore-collaborators__since">
          {expired
            ? t('couple.invite.expired')
            : t('couple.invite.pending', {
                date: cardDate({ at: invitation.expiresAt, timezone, now }),
              })}
        </span>
      </div>
      <div className="kore-collaborators__actions">
        <Button type="button" variant="secondary" disabled={busy} onClick={resend}>
          {t('couple.invite.resend')}
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={cancelInvitation}>
          {t('couple.invite.cancelInvitation')}
        </Button>
      </div>
    </div>
  );
}
