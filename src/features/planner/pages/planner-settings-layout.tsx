import { PageHeader, Tab, Tabs } from '@kore-io/design';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useMatch } from 'react-router';
import { paths } from '../../../app/paths';

/**
 * Configurações da cerimonialista (`/cerimonialista/configuracoes`; Cadastro e perfil RN11;
 * Penpot 15): as abas Acesso e Notificações. A de Notificações fica em branco até o D9
 * (decisão 254(3)).
 */
export function PlannerSettingsLayout() {
  const { t } = useTranslation('planner');
  return (
    <div className="kore-planner-settings">
      <PageHeader title={t('settings.title')} />
      <Tabs aria-label={t('settings.tabs')}>
        <SettingsTab path={paths.plannerSettingsAccess} label={t('settings.access')} />
        <SettingsTab
          path={paths.plannerSettingsNotifications}
          label={t('settings.notifications')}
        />
      </Tabs>
      <Outlet />
    </div>
  );
}

function SettingsTab({ path, label }: { path: string; label: string }) {
  const current = useMatch(path) !== null;
  return (
    <Tab asChild current={current}>
      <Link to={path}>{label}</Link>
    </Tab>
  );
}
