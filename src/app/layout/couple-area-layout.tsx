import { NavItem } from '@kore-io/design';
import { Globe, LayoutDashboard, Music, Send, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useMatch, useNavigate } from 'react-router';
import { useCoupleSession } from '../../features/access/hooks/use-couple-session';
import { useSignOut } from '../../features/access/hooks/use-sign-out';
import { useActiveWedding } from '../../features/guests/hooks/use-active-wedding';
import { paths } from '../paths';
import { menuUser } from '../../features/access/session-user';
import { useNotificationsControllerUnreadV1 } from '../../shared/api/generated/notifications/notifications';
import { useSiteControllerGetV1 } from '../../shared/api/generated/site/site';
import { LoadError } from '../../shared/components/load-error';
import { areaPaths, COUPLE_AREA } from '../area';
import { AppShell } from './app-shell';
import { SiteStatusBadge } from './site-status-badge';

/**
 * Área do casal (/app) com a sessão do GET /v1/me (decisão 163): a Topbar com os nomes do
 * casal ("Ana & Marcos", o casamento de dono) e o Menu do usuário com a pessoa, "Perfil
 * ativo: Casal · Ana & Marcos" e só o Sair na F0. Enquanto o /me carrega (ou redireciona),
 * nada aparece; se ele falhar por rede ou 5xx, o aviso com o Tentar de novo (decisão 164).
 */
/** Os caminhos da área do casal, em `/app`. */
const AREA = areaPaths(COUPLE_AREA.base);

export function CoupleAreaLayout() {
  const { t } = useTranslation('layout');
  const { me, failed, retry } = useCoupleSession();
  const signOut = useSignOut();
  const onGuests = useMatch({ path: AREA.guests, end: false }) !== null;
  const onSite = useMatch({ path: AREA.site, end: false }) !== null;
  const onDeliveries = useMatch({ path: AREA.deliveries, end: false }) !== null;
  const onSongs = useMatch({ path: AREA.songs, end: false }) !== null;
  // Músicas só com a pergunta de música ligada (Música RN03), pelo mesmo GET do Editor.
  const { weddingId, role } = useActiveWedding();
  const navigate = useNavigate();
  // O sino dos donos (Central RN06): ao abrir, ao voltar à aba e a cada 60 s com a aba
  // visível. A colaboradora, até a F6, vê o sino sem contador.
  const owner = role === 'owner';
  const unread = useNotificationsControllerUnreadV1(
    { weddingId: weddingId ?? '' },
    {
      query: {
        enabled: Boolean(weddingId) && owner,
        refetchInterval: 60_000,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: true,
      },
    },
  );
  const site = useSiteControllerGetV1(weddingId ?? '', { query: { enabled: Boolean(weddingId) } });
  // Resposta sem a pergunta (ex.: falha parcial): sem o item, e a área segue de pé.
  const songQuestion = site.data?.songQuestion as { enabled?: boolean } | undefined;
  const songsEnabled = songQuestion?.enabled === true;
  // O selo de status do site na Topbar (Dashboard RN07; decisão 239(B3)).
  const siteStatusValue = (site.data as { status?: unknown } | undefined)?.status;
  // O Dashboard só em /app: telas sem item na Sidebar (ex.: Publicar o site) não marcam nada.
  const onDashboard = useMatch({ path: AREA.dashboard, end: true }) !== null;

  // Sem os dados da pessoa, sem o AppShell: o aviso no meio da tela (decisão 164).
  if (failed) return <LoadError onRetry={retry} />;
  if (!me) return null;

  const couple = me.memberships.find((membership) => membership.role === 'owner')?.weddingName;
  // Trocar de perfil com mais de um perfil; Criar outro perfil quando falta o de
  // cerimonialista e a conta não é de vendas (Cadastro e perfil RN08; decisão 85).
  const profileItems = [
    ...(me.profiles.length > 1
      ? [
          {
            id: 'switch-profile',
            label: t('switchProfile'),
            // O outro perfil na linha de apoio (Voz): o de cerimonialista ou o de vendas.
            ...(me.planner
              ? { detail: t('switchProfilePlanner', { organization: me.planner.organization }) }
              : me.profiles.includes('seller') && { detail: t('switchProfileSeller') }),
            onSelect: () => void navigate(paths.profiles),
          },
        ]
      : []),
    ...(!me.profiles.includes('planner') && !me.profiles.includes('seller')
      ? [
          {
            id: 'create-profile',
            label: t('createProfile'),
            detail: t('createProfilePlanner'),
            onSelect: () => void navigate(paths.plannerSignUp),
          },
        ]
      : []),
  ];

  return (
    <AppShell
      title={couple ?? null}
      {...(typeof siteStatusValue === 'string' && {
        status: <SiteStatusBadge status={siteStatusValue} />,
      })}
      user={menuUser({ user: me.user })}
      activeProfile={
        couple ? t('activeProfileCoupleWedding', { couple }) : t('activeProfileCouple')
      }
      userMenuGroups={[
        [
          {
            id: 'settings',
            label: t('settings'),
            onSelect: () => void navigate(AREA.settingsNotifications),
          },
          ...profileItems,
        ],
        [{ id: 'sign-out', label: t('signOut'), onSelect: signOut }],
      ]}
      notifications={{
        unread: owner ? (unread.data?.unreadCount ?? 0) : 0,
        onOpen: () => void navigate(AREA.notifications),
      }}
      navigation={
        <>
          <NavItem asChild icon={<LayoutDashboard />} current={onDashboard}>
            <Link to={AREA.dashboard}>{t('nav.dashboard')}</Link>
          </NavItem>
          <NavItem asChild icon={<Users />} current={onGuests}>
            <Link to={AREA.guests}>{t('nav.guests')}</Link>
          </NavItem>
          <NavItem asChild icon={<Send />} current={onDeliveries}>
            <Link to={AREA.deliveries}>{t('nav.deliveries')}</Link>
          </NavItem>
          <NavItem asChild icon={<Globe />} current={onSite}>
            <Link to={AREA.site}>{t('nav.site')}</Link>
          </NavItem>
          {songsEnabled && (
            <NavItem asChild icon={<Music />} current={onSongs}>
              <Link to={AREA.songs}>{t('nav.songs')}</Link>
            </NavItem>
          )}
        </>
      }
    >
      <Outlet />
    </AppShell>
  );
}
