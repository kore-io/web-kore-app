import { Button, EmptyState, PageHeader, Spinner, useToast } from '@kore-io/design';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Music } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router';
import { siteSectionPath } from '../../../app/paths';
import { downloadFile } from '../../../shared/api/download-file';
import {
  getSongSuggestionsControllerExportV1Url,
  getSongSuggestionsControllerPageV1QueryKey,
} from '../../../shared/api/generated/rsvp/rsvp';
import { useSiteControllerGetV1 } from '../../../shared/api/generated/site/site';
import { apiErrorCode } from '../../../shared/api/http-client';
import { LoadErrorNotice } from '../../../shared/components/load-error';
import { useActiveWedding } from '../../guests/hooks/use-active-wedding';
import { useLoadMoreOnScroll } from '../../guests/hooks/use-load-more-on-scroll';
import { SONG_QUESTION_SLUG } from '../../site/sections';
import { useSongSuggestions } from '../hooks/use-song-suggestions';
import { suggestedAtText } from '../song-texts';

const EDITOR_PATH = siteSectionPath({ section: SONG_QUESTION_SLUG });

/**
 * Músicas (/app/musicas; Música RN03, RN05, RN06): as sugestões com quem sugeriu, o grupo
 * e a data, e o Exportar para o DJ. Com a pergunta desligada, a página não existe: o
 * caminho leva ao Editor › Pergunta de música.
 */
export function SongsPage() {
  const { weddingId } = useActiveWedding();
  const { t } = useTranslation('songs');
  const site = useSiteControllerGetV1(weddingId ?? '', { query: { enabled: Boolean(weddingId) } });
  if (!weddingId) return null;
  if (site.data && !site.data.songQuestion.enabled) return <Navigate to={EDITOR_PATH} replace />;
  if (site.isError) return <LoadErrorNotice onRetry={() => void site.refetch()} />;
  if (!site.data) {
    return (
      <div className="kore-songs__loading">
        <Spinner label={t('loading')} />
      </div>
    );
  }
  return <Songs weddingId={weddingId} />;
}

function Songs({ weddingId }: { weddingId: string }) {
  const { t } = useTranslation('songs');
  const { t: tCommon } = useTranslation('common');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const list = useSongSuggestions({ weddingId });
  const sentinel = useLoadMoreOnScroll({
    enabled: list.hasMore && !list.loadMoreFailed,
    onLoadMore: list.loadMore,
  });
  const exporting = useMutation({
    mutationFn: () => downloadFile({ path: getSongSuggestionsControllerExportV1Url(weddingId) }),
    onSuccess: () => showToast({ tone: 'success', message: t('exported') }),
    onError: (error) => {
      // Sem sugestões numa corrida (alguém mudou para Não vou): a lista relê e o botão
      // fica desabilitado com o motivo.
      if (apiErrorCode({ error }) === 'NOTHING_TO_EXPORT') {
        void queryClient.invalidateQueries({
          queryKey: getSongSuggestionsControllerPageV1QueryKey(weddingId),
        });
      }
      showToast({
        tone: 'danger',
        message: `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
      });
    },
  });

  // Desligada entre a leitura do site e a da lista: o Editor (RN03).
  if (list.disabled) return <Navigate to={EDITOR_PATH} replace />;
  const empty = list.total === 0;

  return (
    <div className="kore-songs">
      <PageHeader
        title={t('title')}
        actions={
          <div className="kore-songs__actions">
            <Button
              disabled={list.isLoading || empty || exporting.isPending}
              {...(empty && { 'aria-describedby': 'kore-songs-export-help' })}
              onClick={() => exporting.mutate()}
            >
              {t('export')}
            </Button>
            {empty && (
              <p id="kore-songs-export-help" className="kore-songs__export-help">
                {t('exportDisabled')}
              </p>
            )}
          </div>
        }
      />
      {list.isError ? (
        <LoadErrorNotice onRetry={list.retry} />
      ) : list.isLoading ? (
        <div className="kore-songs__loading">
          <Spinner label={t('loading')} />
        </div>
      ) : empty ? (
        <EmptyState
          icon={<Music />}
          title={t('empty.title')}
          description={t('empty.description')}
        />
      ) : (
        <>
          <table className="kore-songs__table">
            <caption className="kore-songs__caption">{t('title')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('columns.song')}</th>
                <th scope="col">{t('columns.guest')}</th>
                <th scope="col">{t('columns.party')}</th>
                <th scope="col">{t('columns.suggestedAt')}</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((item) => (
                <tr key={item.guestId}>
                  <td className="kore-songs__song">{item.song}</td>
                  <td>
                    <CardLabel>{t('columns.guest')}</CardLabel>
                    {item.guestName}
                  </td>
                  <td>
                    <CardLabel>{t('columns.party')}</CardLabel>
                    {item.partyName}
                  </td>
                  <td>
                    <CardLabel>{t('columns.suggestedAt')}</CardLabel>
                    {suggestedAtText({ at: item.suggestedAt })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.hasMore && !list.loadMoreFailed && (
            <div ref={sentinel} className="kore-songs__sentinel" aria-hidden="true" />
          )}
          {list.loadMoreFailed && !list.isLoadingMore && (
            <div className="kore-songs__loading">
              <Button variant="secondary" onClick={list.loadMore}>
                {tCommon('retry')}
              </Button>
            </div>
          )}
          {list.isLoadingMore && (
            <div className="kore-songs__loading">
              <Spinner label={t('loadingMore')} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** O nome da coluna no cartão do celular e do tablet; a tabela já tem o cabeçalho. */
function CardLabel({ children }: { children: string }) {
  return (
    <span className="kore-songs__label" aria-hidden="true">
      {children}:{' '}
    </span>
  );
}
