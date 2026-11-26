import { Alert, Button, Dialog, Input, Spinner, useToast } from '@kore-io/design';
import * as RadixDialog from '@radix-ui/react-dialog';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { areaPaths, plannerWeddingBase } from '../../../app/area';
import { paths } from '../../../app/paths';
import { useAccessInvitationsControllerSendV1 } from '../../../shared/api/generated/access-invitations/access-invitations';
import { getMeControllerMeV1QueryKey } from '../../../shared/api/generated/me/me';
import { useWeddingMembersControllerRemoveV1 } from '../../../shared/api/generated/memberships/memberships';
import type { MyWeddingDetailResponse } from '../../../shared/api/generated/model';
import {
  getMyWeddingsControllerDetailV1QueryKey,
  getMyWeddingsControllerListV1QueryKey,
  useMyWeddingsControllerDetailV1,
} from '../../../shared/api/generated/planner/planner';
import { useWeddingsControllerRemoveV1 } from '../../../shared/api/generated/weddings/weddings';
import { ApiError, apiErrorCode } from '../../../shared/api/http-client';
import { FormField } from '../../../shared/components/form-field';
import { LoadErrorNotice } from '../../../shared/components/load-error';
import { formatRsvpPercent, wholeRsvpPercent } from '../../../shared/rsvp-percent';
import { isValidEmail } from '../../access/email';
import { CoupleLinkBlock } from './couple-link-block';
import { coupleName } from './my-weddings-filters';
import { useCoupleLinkActions } from './use-couple-link-actions';
import { WeddingStatusBadge } from './wedding-status-badge';
import { coupleInvitations, deleteCase, longWeddingDate, sentDay } from './wedding-detail-texts';
import { isWriteLocked, lockedProps, useErrorMessage } from '../../billing/lifecycle/blocked';

/**
 * O Detalhe do casamento (Meus casamentos RN08 a RN11; Penpot 03; decisão 260): o painel
 * lateral de 480 px sobre a lista, com o véu, no tablet e no computador, e a tela inteira no
 * celular. Abre por `/cerimonialista?casamento={id}`; o Fechar volta à lista.
 */
export function WeddingDetailPanel({
  weddingId,
  onClose,
}: {
  weddingId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation('planner');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const detail = useMyWeddingsControllerDetailV1(weddingId, { query: { retry: false } });
  const notFound = detail.error instanceof ApiError && detail.error.status === 404;

  // Sem vínculo (removida, saiu ou o casamento sumiu): volta à lista com o aviso (RN07 da
  // Colaboradora), e a lista é relida.
  useEffect(() => {
    if (!notFound) return;
    void queryClient.invalidateQueries({ queryKey: getMyWeddingsControllerListV1QueryKey() });
    showToast({ tone: 'danger', message: t('myWeddings.detail.unavailable') });
    onClose();
  }, [notFound, queryClient, showToast, t, onClose]);

  return (
    // Modal (decisão 263(1)): a região dos Toasts da lib fica no body, fora do aria-hidden que
    // o modal põe no resto da página, e os avisos (Convite reenviado, Link copiado) seguem
    // anunciados. O clique no véu fecha o painel, como no Penpot.
    <RadixDialog.Root open onOpenChange={(open) => !open && onClose()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="kore-wedding-detail__veil" />
        <RadixDialog.Content
          className="kore-wedding-detail"
          aria-describedby={undefined}
          // Os avisos e os diálogos de confirmação ficam fora do painel: mexer neles não o fecha.
          onInteractOutside={(event) => {
            const target = event.target as Element | null;
            if (target?.closest('[role="region"], [role="dialog"], [role="alertdialog"]')) {
              event.preventDefault();
            }
          }}
        >
          {detail.data ? (
            <DetailContent detail={detail.data} onClose={onClose} />
          ) : (
            <>
              <RadixDialog.Title className="kore-wedding-detail__sr-title">
                {t('myWeddings.detail.loading')}
              </RadixDialog.Title>
              {detail.isError && !notFound ? (
                <LoadErrorNotice onRetry={() => void detail.refetch()} />
              ) : (
                <div className="kore-wedding-detail__loading">
                  <Spinner label={t('myWeddings.detail.loading')} />
                </div>
              )}
            </>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

function DetailContent({
  detail,
  onClose,
}: {
  detail: MyWeddingDetailResponse;
  onClose: () => void;
}) {
  const { t } = useTranslation('planner');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const send = useAccessInvitationsControllerSendV1();
  const linkActions = useCoupleLinkActions({ weddingId: detail.weddingId });
  const leave = useWeddingMembersControllerRemoveV1();
  const remove = useWeddingsControllerRemoveV1();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<'invite' | 'leave' | 'delete' | null>(null);

  const { weddingId, stats } = detail;
  const couple = coupleName(detail);
  const { email, link } = coupleInvitations({ detail });
  const area = areaPaths(plannerWeddingBase({ weddingId }));
  const toDelete = deleteCase({ detail });
  // O vínculo dela, para o Sair (decisão 261).
  const membershipId = detail.myMembershipId;
  const withoutInvitation =
    detail.status === 'draft' && !detail.hasOwner && detail.createdByMe && !email && !link;

  // O casamento bloqueado (Bloqueado RN04; decisão 344): as escritas do detalhe travam com o
  // motivo, e o 403 em corrida vira o Toast com o mesmo texto. O Sair continua (RN03).
  const errorMessage = useErrorMessage();
  const { t: tBilling } = useTranslation('billing');
  const lockReason = detail.blocked ? tBilling('lifecycle.blocked.reason') : null;
  const genericError = (error?: unknown) =>
    showToast({
      tone: 'danger',
      message: errorMessage(error),
    });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: getMyWeddingsControllerDetailV1QueryKey(weddingId) });
  /** Depois de Sair ou Excluir: a lista e o Resumo relidos, o painel fecha e o Toast. */
  const backToList = (message: string) => {
    void queryClient.invalidateQueries({ queryKey: getMyWeddingsControllerListV1QueryKey() });
    void queryClient.invalidateQueries({ queryKey: getMeControllerMeV1QueryKey() });
    onClose();
    showToast({ tone: 'success', message });
  };

  function resend(address: string) {
    send.mutate(
      { weddingId, data: { kind: 'couple', emails: [address] } },
      {
        onSuccess: () => {
          void refresh();
          showToast({
            tone: 'success',
            message: t('myWeddings.detail.resent', { email: address }),
          });
        },
        onError: (error) =>
          showToast({
            tone: 'danger',
            message: isWriteLocked(error)
              ? errorMessage(error)
              : t('myWeddings.detail.resendError'),
          }),
      },
    );
  }

  function confirmLeave() {
    if (!membershipId) return;
    leave.mutate(
      { weddingId, id: membershipId },
      {
        onSuccess: () => backToList(t('myWeddings.detail.leaveDialog.done', { couple })),
        onError: (error) => {
          setDialog(null);
          genericError(error);
        },
      },
    );
  }

  function confirmDelete() {
    remove.mutate(
      { weddingId },
      {
        onSuccess: () => backToList(t('myWeddings.detail.deleteDialog.done', { couple })),
        onError: (error) => {
          setDialog(null);
          // O casal aceitou enquanto ela confirmava (RN11): o aviso e o detalhe relido.
          if (apiErrorCode({ error }) === 'WEDDING_HAS_OWNER') {
            void refresh();
            showToast({ tone: 'danger', message: t('myWeddings.detail.deleteDialog.hasOwner') });
            return;
          }
          genericError(error);
        },
      },
    );
  }

  return (
    <div className="kore-wedding-detail__body">
      <div className="kore-wedding-detail__header">
        <div className="kore-wedding-detail__heading">
          <RadixDialog.Title className="kore-wedding-detail__title">{couple}</RadixDialog.Title>
          <p className="kore-wedding-detail__meta">
            <WeddingStatusBadge status={detail.status} />
            <span>{t(`myWeddings.origin.${detail.origin}`)}</span>
          </p>
        </div>
        <RadixDialog.Close asChild>
          <Button type="button" variant="ghost">
            {t('myWeddings.detail.close')}
          </Button>
        </RadixDialog.Close>
      </div>

      <dl className="kore-wedding-detail__facts">
        <div>
          <dt>{t('myWeddings.detail.dateCity')}</dt>
          <dd>
            {[
              detail.eventDate
                ? longWeddingDate({ date: detail.eventDate })
                : t('myWeddings.noDate'),
              `${detail.city} (${detail.state})`,
            ].join(' · ')}
          </dd>
        </div>
        {detail.slug && (
          <div>
            <dt>{t('myWeddings.detail.site')}</dt>
            <dd>
              {t('myWeddings.detail.siteValue', {
                slug: detail.slug,
                // O site de quem aguarda o casal ainda é rascunho (Penpot 03).
                status: t(
                  `myWeddings.status.${detail.status === 'awaiting_couple' ? 'draft' : detail.status}`,
                ).toLocaleLowerCase('pt-BR'),
              })}
            </dd>
          </div>
        )}
        {email?.email && email.sentAt && (
          <div>
            <dt>{t('myWeddings.detail.invitation')}</dt>
            <dd>
              {t('myWeddings.detail.invitationSent', {
                email: email.email,
                date: sentDay({ at: email.sentAt, timezone: detail.timezone }),
              })}
            </dd>
          </div>
        )}
        <div>
          <dt>{t('myWeddings.detail.guests')}</dt>
          {stats.guestsTotal > 0 ? (
            <dd>
              <span className="kore-wedding-detail__line">
                {t('myWeddings.detail.guestsSummary', {
                  guests: t('myWeddings.detail.guestsCount', { count: stats.guestsTotal }),
                  responded: t('myWeddings.detail.responded', {
                    count: wholeRsvpPercent({ percent: detail.rsvpPercent }),
                    percent: formatRsvpPercent({ percent: detail.rsvpPercent }),
                  }),
                })}
              </span>
              <span className="kore-wedding-detail__line">
                {[
                  t('myWeddings.detail.confirmed', { count: stats.confirmed }),
                  t('myWeddings.detail.declined', { count: stats.declined }),
                  t('myWeddings.detail.pending', { count: stats.pending }),
                ].join(' · ')}
              </span>
            </dd>
          ) : (
            <dd>{t('myWeddings.detail.noGuests')}</dd>
          )}
        </div>
      </dl>

      {detail.status === 'awaiting_couple' && (
        <Alert tone="info">{t('myWeddings.detail.awaitingCouple')}</Alert>
      )}
      {withoutInvitation && <Alert tone="info">{t('myWeddings.detail.noInvitation')}</Alert>}

      {detail.canEditIdentity && (
        <section className="kore-wedding-detail__block" aria-labelledby="kore-detail-identity">
          <h3 id="kore-detail-identity" className="kore-wedding-detail__block-title">
            {t('myWeddings.detail.identity')}
          </h3>
          <p className="kore-wedding-detail__block-text">{t('myWeddings.detail.identityText')}</p>
          <Link
            className="kore-wedding-detail__link"
            to={area.siteSection({ section: 'dados-basicos' })}
          >
            {t('myWeddings.detail.editIdentity')}
          </Link>
        </section>
      )}

      {link && !detail.hasOwner && (
        <CoupleLinkBlock
          link={link}
          busy={send.isPending || linkActions.busy}
          onRegenerate={linkActions.regenerate}
          onCancel={() => linkActions.cancelLink({ id: link.id })}
          lockedReason={lockReason}
        />
      )}

      <div className="kore-wedding-detail__actions">
        {detail.hasOwner ? (
          <Button type="button" size="lg" onClick={() => void navigate(area.site)}>
            {t('myWeddings.detail.editSite')}
          </Button>
        ) : (
          withoutInvitation && (
            <>
              <Button type="button" size="lg" onClick={() => void navigate(area.site)}>
                {t('myWeddings.detail.buildSite')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={() =>
                  void navigate(
                    `${paths.plannerNewWedding}?casamento=${encodeURIComponent(weddingId)}`,
                  )
                }
                {...lockedProps({ locked: detail.blocked, id: 'kore-detail-locked' })}
              >
                {t('myWeddings.detail.inviteCouple')}
              </Button>
            </>
          )
        )}
        {email?.email && !detail.hasOwner && (
          <>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              disabled={send.isPending}
              onClick={() => resend(email.email ?? '')}
              {...lockedProps({ locked: detail.blocked, id: 'kore-detail-locked' })}
            >
              {t('myWeddings.detail.resend')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDialog('invite')}
              {...lockedProps({ locked: detail.blocked, id: 'kore-detail-locked' })}
            >
              {t('myWeddings.detail.inviteAnother')}
            </Button>
          </>
        )}
        {lockReason && (withoutInvitation || (email?.email && !detail.hasOwner)) && (
          <p id="kore-detail-locked" className="kore-write-lock">
            {lockReason}
          </p>
        )}
      </div>

      {(toDelete || (detail.hasOwner && membershipId)) && (
        <div className="kore-wedding-detail__secondary">
          {toDelete ? (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialog('delete')}
                {...lockedProps({ locked: detail.blocked, id: 'kore-detail-delete-locked' })}
              >
                {t('myWeddings.detail.delete')}
              </Button>
              {lockReason && (
                <p id="kore-detail-delete-locked" className="kore-write-lock">
                  {lockReason}
                </p>
              )}
            </>
          ) : (
            <Button type="button" variant="ghost" onClick={() => setDialog('leave')}>
              {t('myWeddings.detail.leave')}
            </Button>
          )}
        </div>
      )}

      {email?.email && (
        <InviteAnotherDialog
          open={dialog === 'invite'}
          weddingId={weddingId}
          previousEmail={email.email}
          onClose={() => setDialog(null)}
          onSent={() => void refresh()}
        />
      )}
      <Dialog
        open={dialog === 'leave'}
        onOpenChange={(open) => !open && setDialog(null)}
        role="alertdialog"
        title={t('myWeddings.detail.leaveDialog.title', { couple })}
        description={t('myWeddings.detail.leaveDialog.description')}
        actions={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              {t('myWeddings.detail.leaveDialog.cancel')}
            </Button>
            <Button variant="destructive" disabled={leave.isPending} onClick={confirmLeave}>
              {t('myWeddings.detail.leaveDialog.confirm')}
            </Button>
          </>
        }
      />
      {toDelete && (
        <Dialog
          open={dialog === 'delete'}
          onOpenChange={(open) => !open && setDialog(null)}
          role="alertdialog"
          title={t('myWeddings.detail.deleteDialog.title', { couple })}
          description={t(`myWeddings.detail.deleteDialog.${toDelete}`)}
          actions={
            <>
              <Button variant="secondary" onClick={() => setDialog(null)}>
                {t('myWeddings.detail.deleteDialog.cancel')}
              </Button>
              <Button variant="destructive" disabled={remove.isPending} onClick={confirmDelete}>
                {t('myWeddings.detail.deleteDialog.confirm')}
              </Button>
            </>
          }
        />
      )}
    </div>
  );
}

/** Convidar outro e-mail (Voz): o convite anterior deixa de funcionar. */
export function InviteAnotherDialog({
  open,
  weddingId,
  previousEmail,
  onClose,
  onSent,
}: {
  open: boolean;
  weddingId: string;
  previousEmail: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const { t } = useTranslation('planner');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  // O bloqueio em corrida (Bloqueado RN04): o motivo, no lugar do genérico.
  const errorMessage = useErrorMessage();
  const send = useAccessInvitationsControllerSendV1();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const formId = 'kore-invite-another';

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim();
    if (!isValidEmail({ email: address })) {
      setError(tAccess('signIn.emailInvalid'));
      return;
    }
    send.mutate(
      { weddingId, data: { kind: 'couple', emails: [address] } },
      {
        onSuccess: () => {
          onSent();
          onClose();
          setEmail('');
          showToast({
            tone: 'success',
            message: t('myWeddings.detail.inviteDialog.sent', { email: address }),
          });
        },
        onError: (failure) => {
          if (failure instanceof ApiError && failure.status === 400) {
            setError(tAccess('signIn.emailInvalid'));
            return;
          }
          showToast({
            tone: 'danger',
            message: errorMessage(failure),
          });
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      role="dialog"
      title={t('myWeddings.detail.inviteDialog.title')}
      description={t('myWeddings.detail.inviteDialog.description', { email: previousEmail })}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('myWeddings.detail.inviteDialog.cancel')}
          </Button>
          <Button type="submit" form={formId} disabled={send.isPending}>
            {t('myWeddings.detail.inviteDialog.submit')}
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={submit}>
        <FormField
          label={t('myWeddings.detail.inviteDialog.email')}
          {...(error && { hint: error, hintTone: 'danger' as const })}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="email"
              autoComplete="email"
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
      </form>
    </Dialog>
  );
}
