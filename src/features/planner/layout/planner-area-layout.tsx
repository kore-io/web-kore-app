import { NavItem } from '@kore-io/design';
import { CreditCard, FileText, Heart, Link2, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useMatch } from 'react-router';
import { AppShell } from '../../../app/layout/app-shell';
import { paths } from '../../../app/paths';
import { LoadError } from '../../../shared/components/load-error';
import { usePlannerSession } from '../hooks/use-planner-session';
import { usePlannerShell } from './use-planner-shell';

/**
 * A moldura da Área do cerimonialista (`/cerimonialista`; Penpot da Área do Cerimonialista,
 * 03, "sem a F3"):
 * - a Sidebar com Meus casamentos, Novo casamento, Comissões (que volta na F3; Comissões do
 *   indicador RN07; decisão 245), Link de indicação e Modelos;
 * - a Topbar com o nome da assessoria, o sino dela (sem contador até o D9; decisão 254(2))
 *   e o Menu do usuário: Meu perfil, Configurações, Trocar de perfil ou Criar outro perfil
 *   (Cadastro e perfil RN08) e Sair, sem Dados para receber (F3).
 */
export function PlannerAreaLayout() {
  const { t } = useTranslation('planner');
  const { me, failed, retry } = usePlannerSession();
  const shell = usePlannerShell({ me });
  const onMyWeddings = useMatch({ path: paths.plannerArea, end: true }) !== null;
  const onNewWedding = useMatch({ path: paths.plannerNewWedding, end: false }) !== null;
  const onReferral = useMatch({ path: paths.plannerReferral, end: false }) !== null;
  const onTemplates = useMatch({ path: paths.plannerTemplates, end: false }) !== null;
  const onCommissions = useMatch({ path: paths.plannerCommissions, end: false }) !== null;

  if (failed) return <LoadError onRetry={retry} />;
  if (!me) return null;

  return (
    <AppShell
      title={shell.organization}
      user={shell.user}
      activeProfile={shell.activeProfile}
      userMenuGroups={shell.userMenuGroups}
      notifications={shell.notifications}
      navigation={
        <>
          <NavItem asChild icon={<Heart />} current={onMyWeddings}>
            <Link to={paths.plannerArea}>{t('nav.myWeddings')}</Link>
          </NavItem>
          <NavItem asChild icon={<Plus />} current={onNewWedding}>
            <Link to={paths.plannerNewWedding}>{t('nav.newWedding')}</Link>
          </NavItem>
          {/* Comissões volta na F3 (Comissões do indicador RN07 e RN08; decisão 245). */}
          <NavItem asChild icon={<CreditCard />} current={onCommissions}>
            <Link to={paths.plannerCommissions}>{t('nav.commissions')}</Link>
          </NavItem>
          <NavItem asChild icon={<Link2 />} current={onReferral}>
            <Link to={paths.plannerReferral}>{t('nav.referral')}</Link>
          </NavItem>
          <NavItem asChild icon={<FileText />} current={onTemplates}>
            <Link to={paths.plannerTemplates}>{t('nav.templates')}</Link>
          </NavItem>
        </>
      }
    >
      <Outlet />
    </AppShell>
  );
}
