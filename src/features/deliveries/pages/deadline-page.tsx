import { Alert, Button, DateField, Spinner, StatCard, useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DashboardResponse } from '../../../shared/api/generated/model';
import {
  getDashboardControllerGetV1QueryKey,
  coupleResponsesControllerDeadlineV1,
  useDashboardControllerGetV1,
} from '../../../shared/api/generated/rsvp/rsvp';
import {
  getSiteControllerGetV1QueryKey,
  useSiteControllerGetV1,
} from '../../../shared/api/generated/site/site';
import { apiErrorCode } from '../../../shared/api/http-client';
import { FormField } from '../../../shared/components/form-field';
import { LoadErrorNotice } from '../../../shared/components/load-error';
import { oneDot, shortDayMonth } from '../../../shared/date-texts';
import { useActiveWedding, type Audience } from '../../guests/hooks/use-active-wedding';
import { deadlineState } from '../deadline';

/** Envios › Prazo de resposta (Prazo e respostas RN01 a RN03; Penpot A7). */
export function DeadlinePage() {
  const { weddingId, audience } = useActiveWedding();
  if (!weddingId) return null;
  return <Deadline weddingId={weddingId} audience={audience} />;
}

function Deadline({ weddingId, audience }: { weddingId: string; audience: Audience }) {
  const { t } = useTranslation('deliveries');
  const dashboard = useDashboardControllerGetV1(weddingId);
  // O fuso do casamento (o Dashboard não traz): as contas do prazo são nele (RN01).
  const site = useSiteControllerGetV1(weddingId);
  if (dashboard.isError) return <LoadErrorNotice onRetry={() => void dashboard.refetch()} />;
  if (!dashboard.data || !site.data) {
    return (
      <div className="kore-deadline__loading">
        <Spinner label={t('deadline.label')} />
      </div>
    );
  }
  return (
    <DeadlineForm
      // Depois de gravar, o formulário volta com o prazo novo.
      key={dashboard.data.rsvpDeadline ?? ''}
      weddingId={weddingId}
      audience={audience}
      dashboard={dashboard.data}
      timezone={site.data.timezone}
    />
  );
}

function DeadlineForm({
  weddingId,
  audience,
  dashboard,
  timezone,
}: {
  weddingId: string;
  audience: Audience;
  dashboard: DashboardResponse;
  timezone: string | null;
}) {
  const { t } = useTranslation('deliveries');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const now = new Date();
  const saved = dashboard.rsvpDeadline;
  const [value, setValue] = useState(saved ?? '');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const state = deadlineState({ deadline: saved, timezone, now });
  const date = (day: string) => shortDayMonth({ day, now });

  async function put(rsvpDeadline: string | null) {
    setSending(true);
    try {
      await coupleResponsesControllerDeadlineV1(weddingId, { rsvpDeadline });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getDashboardControllerGetV1QueryKey(weddingId) }),
        queryClient.invalidateQueries({ queryKey: getSiteControllerGetV1QueryKey(weddingId) }),
      ]);
      showToast({
        tone: 'success',
        message: rsvpDeadline ? t('deadline.saved') : t('deadline.removed'),
      });
    } catch (caught) {
      const code = apiErrorCode({ error: caught });
      if (code === 'DEADLINE_IN_PAST') setError(t(`deadline.inPast.${audience}`));
      else if (code === 'DEADLINE_AFTER_EVENT' && dashboard.eventDate)
        setError(oneDot(t(`deadline.afterEvent.${audience}`, { date: date(dashboard.eventDate) })));
      else
        showToast({
          tone: 'danger',
          message: `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
        });
    } finally {
      setSending(false);
    }
  }

  const hint =
    error ??
    (state.kind === 'ended'
      ? t(`deadline.reopen.${audience}`)
      : state.kind === 'none'
        ? t('deadline.none')
        : saved &&
          oneDot(
            state.kind === 'today'
              ? t('deadline.today', { date: date(saved) })
              : t('deadline.daysLeft', { count: state.daysLeft, date: date(saved) }),
          ));
  const pending = dashboard.reminderQueue;

  return (
    <form
      className="kore-deadline"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (value && value !== saved) void put(value);
      }}
    >
      {state.kind === 'ended' && saved && (
        <Alert tone="warning" title={oneDot(t('deadline.ended', { date: date(saved) }))}>
          {t('deadline.endedText')}
        </Alert>
      )}
      <FormField
        label={t('deadline.label')}
        hint={hint ?? undefined}
        hintTone={error ? 'danger' : 'neutral'}
      >
        {({ id, describedBy, invalid }) => (
          <DateField
            id={id}
            aria-describedby={describedBy}
            invalid={invalid}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError(null);
            }}
          />
        )}
      </FormField>
      {state.kind !== 'ended' && (
        <Alert tone="info" title={t(`deadline.notice.${audience}`)}>
          {t('deadline.noticeText')}
        </Alert>
      )}
      <StatCard
        label={t('deadline.pendingLabel')}
        value={pending.guests}
        detail={t('deadline.pendingDetail', {
          guests: t('deadline.pendingGuests', { count: pending.guests }),
          parties: t('deadline.pendingParties', { count: pending.parties }),
        })}
      />
      <div className="kore-deadline__actions">
        {saved && (
          <Button
            type="button"
            variant="secondary"
            disabled={sending}
            onClick={() => void put(null)}
          >
            {t('deadline.remove')}
          </Button>
        )}
        <Button type="submit" disabled={sending || !value || value === saved}>
          {t('deadline.save')}
        </Button>
      </div>
    </form>
  );
}
