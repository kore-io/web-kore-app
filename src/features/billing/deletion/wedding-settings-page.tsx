import {
  Alert,
  Button,
  Dialog,
  Input,
  PageHeader,
  Spinner,
  Tab,
  Tabs,
  useToast,
} from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useArea, useAreaPaths } from '../../../app/area';
import {
  usePaymentsControllerBillingV1,
  useWeddingDeletionControllerRequestV1,
} from '../../../shared/api/generated/billing/billing';
import {
  getMeControllerMeV1QueryKey,
  useMeControllerMeV1,
} from '../../../shared/api/generated/me/me';
import type { BillingResponse, MeMembershipResponse } from '../../../shared/api/generated/model';
import { apiErrorCode } from '../../../shared/api/http-client';
import { FormField } from '../../../shared/components/form-field';
import { LoadErrorNotice } from '../../../shared/components/load-error';
import { oneDot, shortDayMonth } from '../../../shared/date-texts';
import { useRequestReauth } from '../../access/hooks/use-request-reauth';
import { isReauthRequired } from '../../access/reauth';
import { useActiveWedding } from '../../guests/hooks/use-active-wedding';
import { todayIn } from '../../site/site-texts';
import { useErrorMessage, useWriteLock } from '../lifecycle/blocked';
import { useCancelDeletion } from '../lifecycle/deletion';

/** O dia do expurgo se o casal excluir hoje: hoje + 7, no fuso do casamento (Retenção RN05). */
function purgeDay({ timezone, now }: { timezone: string | null; now: Date }): string {
  const date = new Date(`${todayIn({ timezone, now })}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 7);
  return date.toISOString().slice(0, 10);
}

/**
 * O que impede o Excluir antes de pedir, pelo GET …/billing (Retenção RN06; textos-f3 B8): o
 * prazo de desistir (CDC), que leva a Pagamentos; o reembolso em andamento; e a contestação. O
 * bloqueio vem da trava. A API confere tudo de novo no pedido.
 */
type DeleteGuard = 'cdc' | 'refundInProgress' | 'disputed' | null;

function deleteGuard({ billing }: { billing: BillingResponse }): DeleteGuard {
  const payments = billing.payments ?? [];
  if (payments.some((payment) => payment.status === 'disputed')) return 'disputed';
  if (payments.some((payment) => payment.status === 'refund_requested')) {
    return 'refundInProgress';
  }
  if (payments.some((payment) => payment.status === 'paid' && payment.refundableUntil)) {
    return 'cdc';
  }
  return null;
}

/**
 * Configurações › Casamento (`/app/configuracoes/casamento`, a rota do e-mail da exclusão;
 * Retenção RN05, RN06 e RN08; A11, Penpot 27; textos-f3 B8): a seção Excluir o casamento.
 * - Só o dono exclui; a colaboradora lê "Só o casal pode excluir o casamento.".
 * - O Dialog pede o nome do casal digitado; o `422 CONFIRM_NAME_MISMATCH` vai à ajuda do campo.
 * - As travas: o bloqueio, o prazo de desistir com Ir para Pagamentos, o reembolso em
 *   andamento e a contestação; o Pix pendente só avisa que será cancelado.
 * - A sessão antiga (`403 REAUTH_REQUIRED`) leva ao Entrar e volta aqui.
 * - Com a exclusão agendada, a seção mostra a data e o Cancelar a exclusão.
 * As outras seções da tela no Penpot (data do casamento, Seus dados, Excluir minha conta) não
 * são do E14.
 */
export function WeddingSettingsPage() {
  const { weddingId, role } = useActiveWedding();
  const { data: me } = useMeControllerMeV1();
  if (!weddingId || !me) return null;
  const membership = me.memberships.find((item) => item.weddingId === weddingId);
  if (!membership) return null;
  return <WeddingSettings weddingId={weddingId} membership={membership} owner={role === 'owner'} />;
}

function WeddingSettings({
  weddingId,
  membership,
  owner,
}: {
  weddingId: string;
  membership: MeMembershipResponse;
  owner: boolean;
}) {
  const { t } = useTranslation('billing');
  const { t: tNotifications } = useTranslation('notifications');
  const area = useAreaPaths();
  const { kind } = useArea();
  const { data: me } = useMeControllerMeV1();
  const description = me ? [me.user.name, me.user.email].filter(Boolean).join(' · ') : undefined;
  return (
    <div className="kore-settings">
      <PageHeader title={tNotifications('settings.title')} description={description} />
      {kind === 'couple' && (
        <Tabs aria-label={tNotifications('settings.tabs')}>
          <Tab asChild>
            <Link to={area.settingsNotifications}>{tNotifications('settings.tab')}</Link>
          </Tab>
          <Tab asChild current>
            <Link to={area.settingsWedding}>{t('weddingSettings.tab')}</Link>
          </Tab>
        </Tabs>
      )}
      {owner ? (
        <DeleteSection weddingId={weddingId} membership={membership} />
      ) : (
        <section className="kore-settings__panel" aria-labelledby="kore-wedding-delete">
          <h2 id="kore-wedding-delete" className="kore-settings__section">
            {t('weddingSettings.section')}
          </h2>
          <p className="kore-settings__subtitle">{t('weddingSettings.text')}</p>
          <Button
            variant="destructive"
            className="kore-wedding-delete__button"
            disabled
            aria-describedby="kore-wedding-delete-planner"
          >
            {t('weddingSettings.delete')}
          </Button>
          <p id="kore-wedding-delete-planner" className="kore-write-lock">
            {t('weddingSettings.planner')}
          </p>
        </section>
      )}
    </div>
  );
}

function DeleteSection({
  weddingId,
  membership,
}: {
  weddingId: string;
  membership: MeMembershipResponse;
}) {
  const { t } = useTranslation('billing');
  const paths = useAreaPaths();
  const lock = useWriteLock();
  const billing = usePaymentsControllerBillingV1(weddingId);
  const { cancel, pending } = useCancelDeletion({ weddingId });
  const [open, setOpen] = useState(false);
  const now = new Date();
  const scheduled = membership.lifecycle.deletionScheduledFor;

  const title = (
    <h2 id="kore-wedding-delete" className="kore-settings__section">
      {t('weddingSettings.section')}
    </h2>
  );

  // Com a exclusão agendada, a saída é Cancelar a exclusão (Retenção RN05). No bloqueio, o
  // Cancelar também trava, com o motivo do bloqueio (Bloqueado RN04).
  if (scheduled) {
    const blocked = lock.kind === 'blocked';
    return (
      <section className="kore-settings__panel" aria-labelledby="kore-wedding-delete">
        {title}
        <p className="kore-settings__subtitle">
          {oneDot(t('weddingSettings.scheduled', { date: shortDayMonth({ day: scheduled, now }) }))}
        </p>
        <Button
          variant="secondary"
          className="kore-wedding-delete__button"
          disabled={pending || blocked}
          {...(blocked && { 'aria-describedby': 'kore-wedding-delete-locked' })}
          onClick={cancel}
        >
          {t('lifecycle.deletion.cancel')}
        </Button>
        {blocked && (
          <p id="kore-wedding-delete-locked" className="kore-write-lock">
            {lock.reason}
          </p>
        )}
      </section>
    );
  }

  if (billing.isError) {
    return <LoadErrorNotice onRetry={() => void billing.refetch()} />;
  }
  if (!billing.data) {
    return (
      <div className="kore-settings__loading">
        <Spinner label={t('weddingSettings.section')} />
      </div>
    );
  }

  const guard = deleteGuard({ billing: billing.data });
  const reason =
    lock.kind === 'blocked'
      ? lock.reason
      : guard === 'refundInProgress'
        ? t('weddingSettings.refundInProgress')
        : guard === 'disputed'
          ? t('weddingSettings.disputed')
          : null;
  const pixPending = billing.data.pendingPayment?.method === 'pix';
  const disabled = reason !== null || guard === 'cdc';

  return (
    <section className="kore-settings__panel" aria-labelledby="kore-wedding-delete">
      {title}
      <p className="kore-settings__subtitle">{t('weddingSettings.text')}</p>
      {/* O prazo de desistir vem antes: a tela oferece o Desistir (RN06; textos-f3 B8). */}
      {guard === 'cdc' && lock.kind !== 'blocked' && (
        <Alert tone="warning" title={t('weddingSettings.cdc')} id="kore-wedding-delete-cdc">
          <Link to={paths.billing} className="kore-lifecycle-banner__link">
            {t('weddingSettings.goPayments')}
          </Link>
        </Alert>
      )}
      {pixPending && !disabled && <Alert tone="info" title={t('weddingSettings.pixPending')} />}
      <Button
        variant="destructive"
        className="kore-wedding-delete__button"
        disabled={disabled}
        {...(reason
          ? { 'aria-describedby': 'kore-wedding-delete-locked' }
          : guard === 'cdc' && { 'aria-describedby': 'kore-wedding-delete-cdc' })}
        onClick={() => setOpen(true)}
      >
        {t('weddingSettings.delete')}
      </Button>
      {reason && (
        <p id="kore-wedding-delete-locked" className="kore-write-lock">
          {reason}
        </p>
      )}
      <DeleteDialog
        open={open}
        onClose={() => setOpen(false)}
        weddingId={weddingId}
        couple={membership.weddingName}
        purgeOn={shortDayMonth({ day: purgeDay({ timezone: membership.timezone, now }), now })}
        onCdc={() => void billing.refetch()}
      />
    </section>
  );
}

function DeleteDialog({
  open,
  onClose,
  weddingId,
  couple,
  purgeOn,
  onCdc,
}: {
  open: boolean;
  onClose: () => void;
  weddingId: string;
  couple: string;
  purgeOn: string;
  /** O prazo de desistir que a tela não sabia (409 REFUND_WINDOW_OPEN): a tela relê. */
  onCdc: () => void;
}) {
  const { t } = useTranslation('billing');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const requestReauth = useRequestReauth();
  const request = useWeddingDeletionControllerRequestV1();
  const formId = useId();
  const [name, setName] = useState('');
  const [mismatch, setMismatch] = useState(false);

  function close() {
    setName('');
    setMismatch(false);
    onClose();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    request.mutate(
      { weddingId, data: { confirmName: name } },
      {
        onSuccess: () => {
          close();
          // O /me traz a exclusão agendada: a faixa aparece e o app fica em leitura (RN05).
          void queryClient.invalidateQueries({ queryKey: getMeControllerMeV1QueryKey() });
        },
        onError: (error) => {
          const code = apiErrorCode({ error });
          if (code === 'CONFIRM_NAME_MISMATCH') {
            setMismatch(true);
            return;
          }
          close();
          // A sessão antiga (RN08): o Entrar com o aviso, e a volta para esta tela.
          if (isReauthRequired({ error })) {
            requestReauth({ message: t('weddingSettings.reauth') });
            return;
          }
          if (code === 'REFUND_WINDOW_OPEN') {
            onCdc();
            return;
          }
          const message =
            code === 'REFUND_IN_PROGRESS'
              ? t('weddingSettings.refundInProgress')
              : code === 'PAYMENT_DISPUTED'
                ? t('weddingSettings.disputed')
                : errorMessage(error);
          // A exclusão já agendada (outra pessoa do casal ou outra aba): o /me relido.
          if (code === 'WEDDING_DELETION_SCHEDULED') {
            void queryClient.invalidateQueries({ queryKey: getMeControllerMeV1QueryKey() });
          }
          showToast({ tone: 'danger', message });
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && close()}
      role="alertdialog"
      title={t('weddingSettings.dialog.title', { couple })}
      description={oneDot(t('weddingSettings.dialog.text', { date: purgeOn }))}
      actions={
        <>
          <Button variant="secondary" onClick={close}>
            {t('weddingSettings.dialog.cancel')}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="destructive"
            disabled={!name.trim() || request.isPending}
          >
            {t('weddingSettings.dialog.confirm')}
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={submit}>
        <FormField
          label={
            <Trans
              t={t}
              i18nKey="weddingSettings.dialog.field"
              values={{ couple }}
              components={{ strong: <strong /> }}
            />
          }
          {...(mismatch && {
            hint: t('weddingSettings.dialog.mismatch', { couple }),
            hintTone: 'danger' as const,
          })}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              autoComplete="off"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setMismatch(false);
              }}
            />
          )}
        </FormField>
      </form>
    </Dialog>
  );
}
