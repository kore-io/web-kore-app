import { NavItem } from '@kore-io/design';
import { Globe, LayoutDashboard, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useMatch } from 'react-router';
import { useCoupleSession } from '../../features/access/hooks/use-couple-session';
import { useSignOut } from '../../features/access/hooks/use-sign-out';
import { menuUser } from '../../features/access/session-user';
import { LoadError } from '../../shared/components/load-error';
import { paths } from '../paths';
import { AppShell } from './app-shell';

/**
 * Área do casal (/app) com a sessão do GET /v1/me (decisão 163): a Topbar com os nomes do
 * casal ("Ana & Marcos", o casamento de dono) e o Menu do usuário com a pessoa, "Perfil
 * ativo: Casal · Ana & Marcos" e só o Sair na F0. Enquanto o /me carrega (ou redireciona),
 * nada aparece; se ele falhar por rede ou 5xx, o aviso com o Tentar de novo (decisão 164).
 */
export function CoupleAreaLayout() {
  const { t } = useTranslation('layout');
  const { me, failed, retry } = useCoupleSession();
  const signOut = useSignOut();
  const onGuests = useMatch({ path: paths.guests, end: false }) !== null;
  const onSite = useMatch({ path: paths.site, end: false }) !== null;
  // O Dashboard só em /app: telas sem item na Sidebar (ex.: Publicar o site) não marcam nada.
  const onDashboard = useMatch({ path: paths.coupleArea, end: true }) !== null;

  // Sem os dados da pessoa, sem o AppShell: o aviso no meio da tela (decisão 164).
  if (failed) return <LoadError onRetry={retry} />;
  if (!me) return null;

  const couple = me.memberships.find((membership) => membership.role === 'owner')?.weddingName;

  return (
    <AppShell
      title={couple ?? null}
      user={menuUser({ user: me.user })}
      activeProfile={
        couple ? t('activeProfileCoupleWedding', { couple }) : t('activeProfileCouple')
      }
      userMenuGroups={[[{ id: 'sign-out', label: t('signOut'), onSelect: signOut }]]}
      navigation={
        <>
          <NavItem asChild icon={<LayoutDashboard />} current={onDashboard}>
            <Link to={paths.coupleArea}>{t('nav.dashboard')}</Link>
          </NavItem>
          <NavItem asChild icon={<Users />} current={onGuests}>
            <Link to={paths.guests}>{t('nav.guests')}</Link>
          </NavItem>
          <NavItem asChild icon={<Globe />} current={onSite}>
            <Link to={paths.site}>{t('nav.site')}</Link>
          </NavItem>
        </>
      }
    >
      <Outlet />
    </AppShell>
  );
}
