import { NavItem } from '@kore-io/design';
import { LayoutDashboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet } from 'react-router';
import { useCoupleSession } from '../../features/access/hooks/use-couple-session';
import { useSignOut } from '../../features/access/hooks/use-sign-out';
import { menuUser } from '../../features/access/session-user';
import { LoadError } from '../../shared/components/load-error';
import { paths } from '../paths';
import { AppShell } from './app-shell';

/**
 * Área do casal (/app) com a sessão do GET /v1/me (decisão 163): o Menu do usuário com a
 * pessoa, o perfil ativo e só o Sair na F0; a Topbar sem título até a rota do casamento
 * trazer os nomes. Enquanto o /me carrega (ou redireciona), nada aparece; se ele falhar por
 * rede ou 5xx, o aviso com o Tentar de novo (decisão 164).
 */
export function CoupleAreaLayout() {
  const { t } = useTranslation('layout');
  const { me, failed, retry } = useCoupleSession();
  const signOut = useSignOut();

  // Sem os dados da pessoa, sem o AppShell: o aviso no meio da tela (decisão 164).
  if (failed) return <LoadError onRetry={retry} />;
  if (!me) return null;

  return (
    <AppShell
      title={null}
      user={menuUser({ user: me.user })}
      activeProfile={t('activeProfileCouple')}
      userMenuGroups={[[{ id: 'sign-out', label: t('signOut'), onSelect: signOut }]]}
      navigation={
        <NavItem asChild icon={<LayoutDashboard />} current>
          <Link to={paths.coupleArea}>{t('nav.dashboard')}</Link>
        </NavItem>
      }
    >
      <Outlet />
    </AppShell>
  );
}
