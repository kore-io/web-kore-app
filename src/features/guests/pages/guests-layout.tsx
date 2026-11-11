import { Divider, PageHeader, Tab, Tabs } from '@kore-io/design';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useMatch } from 'react-router';
import { paths } from '../../../app/paths';
import { usePartiesControllerListV1 } from '../../../shared/api/generated/parties/parties';
import { useTagsControllerListV1 } from '../../../shared/api/generated/tags/tags';
import { useActiveWedding } from '../hooks/use-active-wedding';
import { summaryText } from '../party-texts';

/**
 * Convidados (IA da Área do Casal): o título, o resumo do casamento (RN13) e as abas
 * Grupos e convidados · Tags · n de 10 (Tags RN04) · Lixeira, em volta da aba aberta. As
 * outras abas (Importar, Exportar) entram com as telas delas.
 */
export function GuestsLayout() {
  const { weddingId } = useActiveWedding();
  if (!weddingId) return null;
  return <GuestsFrame weddingId={weddingId} />;
}

function GuestsFrame({ weddingId }: { weddingId: string }) {
  const { t } = useTranslation('guests');
  const onTags = useMatch(paths.guestTags) !== null;
  const onTrash = useMatch(paths.guestTrash) !== null;
  // O resumo é do casamento inteiro, sem filtros: basta um grupo na página (limit 1).
  const parties = usePartiesControllerListV1(weddingId, { limit: 1 });
  const tags = useTagsControllerListV1(weddingId);
  const summary = parties.data?.summary;

  return (
    <div className="kore-guests">
      <PageHeader title={t('title')} description={summary && summaryText({ t, summary })} />
      <div className="kore-guests__tabs">
        <Tabs aria-label={t('tabs.label')}>
          <Tab asChild current={!onTags && !onTrash}>
            <Link to={paths.guests}>
              <span className="kore-guests__tab-long">{t('tabs.parties')}</span>
              <span className="kore-guests__tab-short">{t('tabs.partiesShort')}</span>
            </Link>
          </Tab>
          <Tab asChild current={onTags}>
            <Link to={paths.guestTags}>
              <span className="kore-guests__tab-long">
                {tags.data
                  ? t('tabs.tags', { count: tags.data.data.length, limit: tags.data.limit })
                  : t('tabs.tagsShort')}
              </span>
              <span className="kore-guests__tab-short">{t('tabs.tagsShort')}</span>
            </Link>
          </Tab>
          <Tab asChild current={onTrash}>
            <Link to={paths.guestTrash}>{t('tabs.trash')}</Link>
          </Tab>
        </Tabs>
        <Divider />
      </div>
      <Outlet />
    </div>
  );
}
