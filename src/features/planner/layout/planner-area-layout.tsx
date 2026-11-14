import { NavItem } from '@kore-io/design';
import { FileText, Heart, Link2, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useMatch, useNavigate } from 'react-router';
import { AppShell } from '../../../app/layout/app-shell';
import { paths } from '../../../app/paths';
import { LoadError } from '../../../shared/components/load-error';
import { useSignOut } from '../../access/hooks/use-sign-out';
import { menuUser } from '../../access/session-user';
import { usePlannerSession } from '../hooks/use-planner-session';

/**
 * A moldura da Área do cerimonialista (`/cerimonialista`; Penpot da Área do Cerimonialista,
 * 03, "sem a F3"):
 * - a Sidebar com Meus casamentos, Novo casamento, Link de indicação e Modelos, sem
 *   Comissões, que é da F3 (decisão 245);
 * - a Topbar com o nome da assessoria, o sino dela (sem contador até o D9; decisão 254(2))
 *   e o Menu do usuário: Meu perfil, Configurações, Trocar de perfil ou Criar outro perfil
 *   (Cadastro e perfil RN08) e Sair, sem Dados para receber (F3).
 */
export function PlannerAreaLayout() {
  const { t } = useTranslation('planner');
  const { me, failed, retry } = usePlannerSession();
  const signOut = useSignOut();
  const navigate = useNavigate();
  const onMyWeddings = useMatch({ path: paths.plannerArea, end: true }) !== null;
  const onNewWedding = useMatch({ path: paths.plannerNewWedding, end: false }) !== null;
  const onReferral = useMatch({ path: paths.plannerReferral, end: false }) !== null;
  const onTemplates = useMatch({ path: paths.plannerTemplates, end: false }) !== null;

  if (failed) return <LoadError onRetry={retry} />;
  if (!me) return null;

  const organization = me.planner?.organization ?? '';
  const couple = me.memberships.find((membership) => membership.role === 'owner')?.weddingName;
  // Trocar de perfil com mais de um perfil; Criar outro perfil quando falta o de casal e a
  // conta não é de vendas (RN08; decisão 85): a cerimonialista cria o casal pelo /cadastro.
  const profileItems = [
    ...(me.profiles.length > 1
      ? [
          {
            id: 'switch-profile',
            label: t('menu.switchProfile'),
            ...(couple && { detail: t('menu.switchProfileCouple', { couple }) }),
            onSelect: () => void navigate(paths.profiles),
          },
        ]
      : []),
    ...(!me.profiles.includes('couple') && !me.profiles.includes('seller')
      ? [
          {
            id: 'create-profile',
            label: t('menu.createProfile'),
            detail: t('menu.createProfileCouple'),
            onSelect: () => void navigate(paths.signUp),
          },
        ]
      : []),
  ];

  return (
    <AppShell
      title={organization}
      user={menuUser({ user: me.user })}
      activeProfile={t('menu.activeProfile', { organization })}
      userMenuGroups={[
        [
          {
            id: 'profile',
            label: t('menu.profile'),
            onSelect: () => void navigate(paths.plannerProfile),
          },
          {
            id: 'settings',
            label: t('menu.settings'),
            onSelect: () => void navigate(paths.plannerSettings),
          },
          ...profileItems,
        ],
        [{ id: 'sign-out', label: t('menu.signOut'), onSelect: signOut }],
      ]}
      notifications={{ unread: 0, onOpen: () => void navigate(paths.plannerNotifications) }}
      navigation={
        <>
          <NavItem asChild icon={<Heart />} current={onMyWeddings}>
            <Link to={paths.plannerArea}>{t('nav.myWeddings')}</Link>
          </NavItem>
          <NavItem asChild icon={<Plus />} current={onNewWedding}>
            <Link to={paths.plannerNewWedding}>{t('nav.newWedding')}</Link>
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
