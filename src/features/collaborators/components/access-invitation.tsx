import { Alert, Button, Dialog, Input, useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';
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
import {
  isWeddingBlocked,
  lockedProps,
  useErrorMessage,
  useWriteLock,
  WriteLockReason,
} from '../../billing/lifecycle/blocked';

/**
 * Os status em que o site está no ar, como o `live` da API (publicado, depois do evento e
 * carência): o aviso da C7-6 só faz sentido com o site aberto.
 */
const ONLINE = new Set(['published', 'post_event', 'grace']);

export type InvitationKind = 'planner' | 'partner';

/** Os textos de cada convite: o da cerimonialista (276/277) e o da outra pessoa do casal (decisões 279 e 284). */
function useInviteTexts({ kind }: { kind: InvitationKind }) {
  const { t } = useTranslation('collaborators');
  return kind === 'planner'
    ? {
        open: t('couple.invite.open'),
        title: t('couple.invite.dialog.title'),
        description: t('couple.invite.dialog.description'),
        email: t('couple.invite.dialog.email'),
        placeholder: t('couple.invite.dialog.placeholder'),
        submit: t('couple.invite.dialog.submit'),
        cancel: t('couple.invite.dialog.cancel'),
        ownEmail: t('couple.invite.ownEmail'),
        fullCode: 'PLANNER_ALREADY',
        full: t('couple.invite.plannerAlready'),
      }
    : {
        open: t('couple.invitePartner.open'),
        title: t('couple.invitePartner.dialog.title'),
        description: t('couple.invitePartner.dialog.description'),
        email: t('couple.invitePartner.dialog.email'),
        placeholder: t('couple.invitePartner.dialog.placeholder'),
        submit: t('couple.invitePartner.dialog.submit'),
        cancel: t('couple.invitePartner.dialog.cancel'),
        ownEmail: t('couple.invitePartner.ownEmail'),
        fullCode: 'OWNERS_FULL',
        full: t('couple.invitePartner.ownersFull'),
      };
}

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
  return (
    <>
      <p className="kore-collaborators__empty">{t('couple.invite.empty')}</p>
      <InviteButton kind="planner" weddingId={weddingId} />
    </>
  );
}

/**
 * O botão que abre o Dialog do convite. O Convidar a outra pessoa (decisões 279 e 284; Navegação da Área
 * do Casal) aparece no cartão Casal enquanto há menos de 2 donos e nenhum convite pendente.
 */
export function InviteButton({ kind, weddingId }: { kind: InvitationKind; weddingId: string }) {
  const texts = useInviteTexts({ kind });
  const [open, setOpen] = useState(false);
  // Bloqueado RN04: convidar é escrita.
  const lock = useWriteLock();
  const lockId = `${useId()}-locked`;
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        className="kore-collaborators__invite"
        onClick={() => setOpen(true)}
        {...lockedProps({ locked: lock.locked, id: lockId })}
      >
        {texts.open}
      </Button>
      <WriteLockReason id={lockId} className="kore-collaborators__help" />
      <InviteDialog kind={kind} open={open} weddingId={weddingId} onClose={() => setOpen(false)} />
    </>
  );
}

function InviteDialog({
  kind,
  open,
  weddingId,
  onClose,
}: {
  kind: InvitationKind;
  open: boolean;
  weddingId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation('collaborators');
  const texts = useInviteTexts({ kind });
  const { showToast } = useToast();
  const errorMessage = useErrorMessage();
  const refresh = useRefreshMembers({ weddingId });
  const send = useAccessInvitationsControllerSendV1();
  const me = useMeControllerMeV1();
  const site = useSiteControllerGetV1(weddingId, { query: { enabled: kind === 'planner' } });
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const formId = `kore-invite-${kind}`;
  // O aviso da C7-6 (decisão 277(A)), só no convite da cerimonialista: o site no ar e a
  // assinatura não ocultada pelo casal. A preferência vem na raiz do GET …/site, também
  // sem cerimonialista (o plannerCredit fica nulo sem colaboradora).
  const showNotice =
    kind === 'planner' &&
    ONLINE.has(site.data?.status ?? '') &&
    site.data?.showPlannerCredit === true;

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
    // O próprio e-mail só no app: a API não barra nos kinds planner e partner (decisão 277).
    if (me.data && address.toLowerCase() === me.data.user.email.toLowerCase()) {
      setError(texts.ownEmail);
      return;
    }
    send.mutate(
      { weddingId, data: { kind, emails: [address] } },
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
          if (apiErrorCode({ error: failure }) === texts.fullCode) {
            // Alguém do casal convidou ou entrou antes: fecha e relê a lista.
            refresh();
            close();
            showToast({ tone: 'danger', message: texts.full });
            return;
          }
          showToast({
            tone: 'danger',
            // O bloqueio em corrida (Bloqueado RN04): o motivo, no lugar do erro do envio.
            message: isWeddingBlocked(failure)
              ? errorMessage(failure)
              : t('couple.invite.sendError'),
          });
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && close()}
      role="dialog"
      title={texts.title}
      description={texts.description}
      actions={
        <>
          <Button variant="secondary" onClick={close}>
            {texts.cancel}
          </Button>
          <Button type="submit" form={formId} disabled={send.isPending}>
            {texts.submit}
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={submit} className="kore-collaborators__form">
        <FormField label={texts.email} {...(error && { hint: error, hintTone: 'danger' as const })}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="email"
              autoComplete="email"
              placeholder={texts.placeholder}
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
 * O convite pendente, da cerimonialista ou da outra pessoa do casal (decisões 276(3), 277 e 279): o e-mail, "vale até {dd/mm}"
 * (com o ano quando não é o atual) ou "O convite venceu.", com Reenviar convite e Cancelar
 * convite (sem confirmação: cancelar não tira ninguém de dentro).
 */
export function PendingInvitation({
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
  const errorMessage = useErrorMessage();
  // Bloqueado RN04: reenviar e cancelar o convite são escrita.
  const lock = useWriteLock();
  const lockId = `${useId()}-locked`;
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
    showToast({ tone: 'danger', message: isWeddingBlocked(error) ? errorMessage(error) : message });
  }

  function resend() {
    send.mutate(
      { weddingId, data: { kind: invitation.kind, emails: [email] } },
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
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={resend}
          {...lockedProps({ locked: lock.locked, id: lockId })}
        >
          {t('couple.invite.resend')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={cancelInvitation}
          {...lockedProps({ locked: lock.locked, id: lockId })}
        >
          {t('couple.invite.cancelInvitation')}
        </Button>
      </div>
      <WriteLockReason id={lockId} className="kore-collaborators__help" />
    </div>
  );
}
