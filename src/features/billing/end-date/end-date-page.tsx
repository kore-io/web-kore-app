import { Alert, Button, DateField, PageHeader, Spinner, useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { useAreaPaths } from '../../../app/area';
import {
  getPaymentsControllerBillingV1QueryKey,
  paymentsControllerEndDateV1,
} from '../../../shared/api/generated/billing/billing';
import {
  getMeControllerMeV1QueryKey,
  useMeControllerMeV1,
} from '../../../shared/api/generated/me/me';
import type { MeMembershipResponse } from '../../../shared/api/generated/model';
import { getDashboardControllerGetV1QueryKey } from '../../../shared/api/generated/rsvp/rsvp';
import { getSiteControllerGetV1QueryKey } from '../../../shared/api/generated/site/site';
import { apiErrorCode } from '../../../shared/api/http-client';
import { FormField } from '../../../shared/components/form-field';
import { Panel } from '../../../shared/components/panel';
import { oneDot, shortDayMonth } from '../../../shared/date-texts';
import { useActiveWedding } from '../../guests/hooks/use-active-wedding';
import {
  canChangeEndDateFree,
  endDateChoice,
  endDateLimits,
  paidAhead,
  type EndDateChoice,
  type EndDateSource,
} from './end-date';

/**
 * Mudar a data de saída do ar (`…/cobranca/data-de-saida`; Data de saída RN05; 289; 293; 294;
 * Penpot 21, A6). No E10, só o que não cobra, pelo `PATCH …/end-date`: antecipar e voltar de
 * graça até o `paidThrough`, também no expirado (Voltar ao ar). A data depois do `paidThrough`
 * é a extensão: o Pagar e adiar e o Pagar e renovar ficam desabilitados até o E11 (333(1)).
 * Só o dono muda a data; a colaboradora e quem não tem o que mudar voltam a Pagamentos.
 */
export function EndDatePage() {
  const { weddingId, role } = useActiveWedding();
  const paths = useAreaPaths();
  const { data: me } = useMeControllerMeV1();
  if (!weddingId || !me) return null;
  const membership = me.memberships.find((item) => item.weddingId === weddingId);
  if (role !== 'owner' || !membership?.lifecycle) {
    return <Navigate to={paths.billing} replace />;
  }
  return <EndDate weddingId={weddingId} membership={membership} />;
}

function sourceOf(membership: MeMembershipResponse): EndDateSource {
  return {
    status: membership.lifecycle.status,
    endDate: membership.lifecycle.endDate,
    paidThrough: membership.lifecycle.paidThrough,
    eventDate: membership.eventDate,
    timezone: membership.timezone,
  };
}

function EndDate({
  weddingId,
  membership,
}: {
  weddingId: string;
  membership: MeMembershipResponse;
}) {
  const { t } = useTranslation('billing');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const paths = useAreaPaths();
  const reasonId = useId();
  const now = new Date();
  const source = sourceOf(membership);
  const expired = source.status === 'expired';
  const ahead = paidAhead({ source, now });
  const [date, setDate] = useState(() => (expired ? (ahead ?? '') : (source.endDate ?? '')));
  const [beyondPaid, setBeyondPaid] = useState(false);
  const [sending, setSending] = useState(false);

  const limits = endDateLimits({ source, now });
  if (!limits || !canChangeEndDateFree({ source, now })) {
    return <Navigate to={paths.billing} replace />;
  }
  const day = (value: string) => shortDayMonth({ day: value, now });
  const choice: EndDateChoice = date ? endDateChoice({ source, date, now }) : 'invalid';
  const blocked = membership.lifecycle.blocked;

  const subtitle = expired
    ? membership.lifecycle.expiredAt &&
      oneDot(t('endDate.offAirSince', { date: day(membership.lifecycle.expiredAt) }))
    : (() => {
        // Na carência, o site fica no ar até o fim do graceUntil (RN01).
        const until = source.status === 'grace' ? membership.lifecycle.graceUntil : source.endDate;
        return until && oneDot(t('endDate.onAirUntil', { date: day(until) }));
      })();
  const help = ahead
    ? t('endDate.helpPaidAhead', { paidThrough: day(ahead), max: day(limits.max) })
    : t('endDate.help', { max: day(limits.max) });

  // O primário pelo caso (Penpot 21, A6; 293(4)): Antecipar a data, Voltar ao ar ou Voltar a
  // data; a extensão (Pagar e adiar e Pagar e renovar) fica desabilitada até o E11.
  const primary =
    choice === 'bringForward'
      ? t('endDate.bringForward')
      : choice === 'restore'
        ? expired
          ? t('endDate.backOnline')
          : t('endDate.backDate')
        : expired
          ? t('endDate.renew')
          : t('endDate.extend');
  const canSubmit = (choice === 'bringForward' || choice === 'restore') && !blocked && !sending;

  async function submit() {
    setSending(true);
    setBeyondPaid(false);
    try {
      const changed = await paymentsControllerEndDateV1(weddingId, { endDate: date });
      // O Toast da 293(6): no expirado, "voltou ao ar"; nos outros, "fica no ar até".
      showToast({
        tone: 'success',
        message: oneDot(
          t(expired ? 'endDate.toast.backOnline' : 'endDate.toast.until', {
            date: day(changed.endDate),
          }),
        ),
      });
      await Promise.all(
        [
          getMeControllerMeV1QueryKey(),
          getPaymentsControllerBillingV1QueryKey(weddingId),
          getSiteControllerGetV1QueryKey(weddingId),
          getDashboardControllerGetV1QueryKey(weddingId),
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      ).catch(() => undefined);
      void navigate(paths.billing);
    } catch (error) {
      setSending(false);
      const code = apiErrorCode({ error });
      if (code === 'END_DATE_BEYOND_PAID') {
        // A data passou do paidThrough entre a tela e o envio (293(8); 294(1)).
        setBeyondPaid(true);
        void queryClient.invalidateQueries({ queryKey: getMeControllerMeV1QueryKey() });
        return;
      }
      if (code === 'WEDDING_BLOCKED') {
        void queryClient.invalidateQueries({ queryKey: getMeControllerMeV1QueryKey() });
        showToast({ tone: 'danger', message: t('publish.reason.blocked') });
        return;
      }
      showToast({
        tone: 'danger',
        message: `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
      });
      if (code !== undefined) {
        void queryClient.invalidateQueries({ queryKey: getMeControllerMeV1QueryKey() });
      }
    }
  }

  const outOfRange = date !== '' && choice === 'invalid';
  return (
    <div className="kore-end-date">
      <PageHeader title={t('endDate.title')} {...(subtitle && { description: subtitle })} />
      <div className="kore-end-date__columns">
        <div className="kore-end-date__choices">
          <Panel>
            <FormField
              label={t('endDate.label')}
              hint={
                beyondPaid
                  ? t('endDate.beyondPaid')
                  : outOfRange
                    ? t('publish.endDate.outOfRange', { max: day(limits.max) })
                    : help
              }
              hintTone={beyondPaid || outOfRange ? 'danger' : 'neutral'}
            >
              {({ id, describedBy, invalid }) => (
                <DateField
                  id={id}
                  value={date}
                  min={limits.min}
                  max={limits.max}
                  invalid={invalid}
                  disabled={sending}
                  {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
                  onChange={(event) => {
                    setBeyondPaid(false);
                    setDate(event.target.value);
                  }}
                />
              )}
            </FormField>
          </Panel>
        </div>
        <div className="kore-end-date__summary">
          {choice === 'bringForward' && <Alert tone="info">{t('endDate.bringForwardAlert')}</Alert>}
          {choice === 'restore' && source.paidThrough && (
            <Alert tone="info">{t('endDate.freeAlert', { date: day(source.paidThrough) })}</Alert>
          )}
          {blocked && (
            <p id={reasonId} className="kore-end-date__reason">
              {t('publish.reason.blocked')}
            </p>
          )}
          <div className="kore-end-date__buttons">
            <Button variant="secondary" size="lg" onClick={() => void navigate(paths.billing)}>
              {t('endDate.cancel')}
            </Button>
            <Button
              size="lg"
              disabled={!canSubmit}
              {...(blocked && { 'aria-describedby': reasonId })}
              onClick={() => void submit()}
            >
              {sending ? <Spinner label={primary} /> : primary}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
