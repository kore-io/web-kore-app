import { Divider, PageHeader, Tab, Tabs } from '@kore-io/design';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useMatch } from 'react-router';
import { paths } from '../../../app/paths';

/**
 * Envios (IA da Área do Casal; Penpot, página 07): o título e as abas, em volta da aba
 * aberta. No C3 da F4, só o Prazo de resposta; Enviar convites, Save the date e Lembrar
 * pendentes, com o resumo dos envios no topo, chegam com o C4.
 */
export function DeliveriesLayout() {
  const { t } = useTranslation('deliveries');
  const onDeadline = useMatch(paths.deliveryDeadline) !== null;
  return (
    <div className="kore-deliveries">
      <PageHeader title={t('title')} />
      <div className="kore-deliveries__tabs">
        <Tabs aria-label={t('tabs.label')}>
          <Tab asChild current={onDeadline}>
            <Link to={paths.deliveryDeadline}>
              <span className="kore-deliveries__tab-long">{t('tabs.deadline')}</span>
              <span className="kore-deliveries__tab-short">{t('tabs.deadlineShort')}</span>
            </Link>
          </Tab>
        </Tabs>
        <Divider />
      </div>
      <Outlet />
    </div>
  );
}
