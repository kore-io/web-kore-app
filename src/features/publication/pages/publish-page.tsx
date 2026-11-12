import { Alert, Button, DateField, PageHeader, Spinner, useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { paths } from '../../../app/paths';
import { getDashboardControllerGetV1QueryKey } from '../../../shared/api/generated/rsvp/rsvp';
import type { SiteEditorResponse } from '../../../shared/api/generated/model';
import {
  getSiteControllerGetV1QueryKey,
  publicationControllerCreateV1,
  useSiteControllerGetV1,
} from '../../../shared/api/generated/site/site';
import { getMeControllerMeV1QueryKey } from '../../../shared/api/generated/me/me';
import { ApiError, apiErrorCode } from '../../../shared/api/http-client';
import { FormField } from '../../../shared/components/form-field';
import { LoadErrorNotice } from '../../../shared/components/load-error';
import { useActiveWedding } from '../../guests/hooks/use-active-wedding';
import {
  canOpenPublish,
  endDateInRange,
  publishBlock,
  shortDate,
  type PublishBlock,
} from '../publication';

/** Os 409 que o servidor dá numa corrida, com o texto do motivo (RN01 a RN04). */
const BLOCK_BY_CODE: Record<string, PublishBlock> = {
  COURTESY_DISABLED: 'courtesyDisabled',
  SITE_SLUG_MISSING: 'slugMissing',
  EVENT_DATE_MISSING: 'eventDateMissing',
  ACTION_NOT_ALLOWED: 'notOwner',
};

/**
 * Cobrança e publicação › Publicar o site, por Cortesia (Publicação por Cortesia RN01 a
 * RN07; Penpot A1, página 21; decisão 228). Sem preço nem forma de pagamento: a data de
 * saída do ar, o aviso da trava do endereço e o Publicar. Publicado, volta ao Dashboard.
 */
export function PublishPage() {
  const { weddingId, role } = useActiveWedding();
  if (!weddingId) return null;
  return <Publish weddingId={weddingId} role={role} />;
}

function Publish({ weddingId, role }: { weddingId: string; role: string | undefined }) {
  const { t } = useTranslation('site');
  const site = useSiteControllerGetV1(weddingId);
  if (site.isError) return <LoadErrorNotice onRetry={() => void site.refetch()} />;
  if (!site.data) {
    return (
      <div className="kore-publish__loading">
        <Spinner label={t('loading')} />
      </div>
    );
  }
  // Já publicado (ou depois): não há o que publicar aqui na F4 (decisão 228(2)).
  if (!canOpenPublish(site.data.status)) return <Navigate to={paths.coupleArea} replace />;
  return <PublishForm weddingId={weddingId} site={site.data} role={role} />;
}

function PublishForm({
  weddingId,
  site,
  role,
}: {
  weddingId: string;
  site: SiteEditorResponse;
  role: string | undefined;
}) {
  const { t } = useTranslation('site');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const reasonId = useId();
  // A data começa vazia (decisão 228(3)); Publicar sem ela mostra o erro dos limites.
  const [endDate, setEndDate] = useState('');
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const block = publishBlock({ site, role });
  const { endDateMin, endDateMax } = site.publication;
  const outOfRange = (max: string | null) =>
    t('publication.endDateOutOfRange', { max: max ? shortDate(max) : '' });

  function leave() {
    // Volta para quem abriu (o Editor ou o Dashboard); aberta direto, vai ao Dashboard.
    if (location.key !== 'default') void navigate(-1);
    else void navigate(paths.coupleArea);
  }

  async function publish() {
    if (block || sending) return;
    if (!endDateInRange({ endDate, min: endDateMin, max: endDateMax })) {
      setRangeError(outOfRange(endDateMax));
      return;
    }
    setSending(true);
    try {
      await publicationControllerCreateV1(weddingId, { endDate });
      await refresh();
      showToast({ tone: 'success', message: t('publication.published') });
      void navigate(paths.coupleArea, { replace: true });
    } catch (error) {
      handleError(error);
    } finally {
      setSending(false);
    }
  }

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getSiteControllerGetV1QueryKey(weddingId) }),
      queryClient.invalidateQueries({
        queryKey: getDashboardControllerGetV1QueryKey(weddingId),
      }),
      queryClient.invalidateQueries({ queryKey: getMeControllerMeV1QueryKey() }),
    ]);
  }

  function handleError(error: unknown) {
    const code = apiErrorCode({ error });
    if (code === 'END_DATE_OUT_OF_RANGE' && error instanceof ApiError) {
      const body = error.body as { endDateMax?: string | null };
      setRangeError(outOfRange(body.endDateMax ?? endDateMax));
      return;
    }
    // Corrida: o estado mudou entre abrir e publicar. A tela recarrega com o motivo novo.
    if (code === 'NOT_DRAFT') {
      void refresh();
      showToast({
        tone: site.status === 'awaiting_couple' ? 'danger' : 'success',
        message: t(
          site.status === 'awaiting_couple'
            ? 'publication.blocked.awaitingCouple'
            : 'publication.alreadyPublished',
        ),
      });
      return;
    }
    const known = code ? BLOCK_BY_CODE[code] : undefined;
    if (known) {
      void refresh();
      showToast({ tone: 'danger', message: t(`publication.blocked.${known}`) });
      return;
    }
    showToast({
      tone: 'danger',
      message: `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
    });
  }

  return (
    <div className="kore-publish">
      <PageHeader title={t('publication.title')} description={t('publication.description')} />
      <form
        className="kore-publish__form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void publish();
        }}
      >
        <div className="kore-publish__panel">
          <p className="kore-publish__lead">{t('publication.chooseEndDate')}</p>
          <FormField
            label={t('publication.endDate')}
            hint={
              rangeError ??
              (endDateMax ? t('publication.endDateHelp', { max: shortDate(endDateMax) }) : '')
            }
            hintTone={rangeError ? 'danger' : 'neutral'}
          >
            {({ id, describedBy }) => (
              <DateField
                id={id}
                aria-describedby={describedBy}
                invalid={rangeError !== null}
                value={endDate}
                {...(endDateMin && { min: endDateMin })}
                {...(endDateMax && { max: endDateMax })}
                onChange={(event) => {
                  setEndDate(event.target.value);
                  setRangeError(null);
                }}
              />
            )}
          </FormField>
        </div>
        {site.slug && <Alert tone="info">{t('publication.slugLocked', { slug: site.slug })}</Alert>}
        <div className="kore-publish__actions">
          {block && (
            <p id={reasonId} className="kore-publish__reason">
              {t(`publication.blocked.${block}`)}
            </p>
          )}
          <Button type="button" variant="secondary" onClick={leave}>
            {t('publication.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={block !== null || sending}
            {...(block && { 'aria-describedby': reasonId })}
          >
            {t('publication.publish')}
          </Button>
        </div>
      </form>
    </div>
  );
}
