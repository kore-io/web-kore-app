import { Button, Divider, PageHeader, Tab, Tabs } from '@kore-io/design';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useMatch, useNavigate } from 'react-router';
import { paths } from '../../../app/paths';
import { usePartiesControllerListV1 } from '../../../shared/api/generated/parties/parties';
import { useTagsControllerListV1 } from '../../../shared/api/generated/tags/tags';
import { useActiveWedding } from '../hooks/use-active-wedding';
import { summaryText } from '../party-texts';

/**
 * Convidados (IA da Área do Casal): o título, o resumo do casamento (RN13) e as abas
 * Grupos e convidados · Importar · Exportar · Tags · n de 10 (Tags RN04) · Lixeira, em volta
 * da aba aberta, e o Importar planilha no topo (Importação RN01).
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
  const onImport = useMatch(paths.guestImport) !== null;
  const onExport = useMatch(paths.guestExport) !== null;
  const navigate = useNavigate();
  // O resumo é do casamento inteiro, sem filtros: basta um grupo na página (limit 1).
  const parties = usePartiesControllerListV1(weddingId, { limit: 1 });
  const tags = useTagsControllerListV1(weddingId);
  const summary = parties.data?.summary;

  return (
    <div className="kore-guests">
      <PageHeader
        title={t('title')}
        description={summary && summaryText({ t, summary })}
        actions={
          <Button variant="secondary" onClick={() => void navigate(paths.guestImport)}>
            {t('importSheet.headerButton')}
          </Button>
        }
      />
      <div className="kore-guests__tabs">
        <Tabs aria-label={t('tabs.label')}>
          <Tab asChild current={!onTags && !onTrash && !onImport && !onExport}>
            <Link to={paths.guests}>
              <span className="kore-guests__tab-long">{t('tabs.parties')}</span>
              <span className="kore-guests__tab-short">{t('tabs.partiesShort')}</span>
            </Link>
          </Tab>
          <Tab asChild current={onImport}>
            <Link to={paths.guestImport}>{t('tabs.import')}</Link>
          </Tab>
          <Tab asChild current={onExport}>
            <Link to={paths.guestExport}>{t('tabs.export')}</Link>
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
