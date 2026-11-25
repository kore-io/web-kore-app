import { useTranslation } from 'react-i18next';
import { Outlet, useNavigate } from 'react-router';
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
import { BlockedBanner, useWeddingBlockedRefetch } from '../../features/billing/lifecycle/blocked';
import { LifecycleBadge, LifecycleBanner } from '../../features/billing/lifecycle/lifecycle-banner';
import { WeddingNavigation } from './wedding-navigation';

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
  // Músicas só com a pergunta de música ligada (Música RN03), pelo mesmo GET do Editor.
  const { weddingId, role } = useActiveWedding();
  const navigate = useNavigate();
  useWeddingBlockedRefetch();
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

  // Sem os dados da pessoa, sem o AppShell: o aviso no meio da tela (decisão 164).
  if (failed) return <LoadError onRetry={retry} />;
  if (!me) return null;

  const ownMembership = me.memberships.find((membership) => membership.role === 'owner');
  const couple = ownMembership?.weddingName;
  // O ciclo de vida do /me: o selo da Topbar e a faixa (329(3); Data de saída RN06).
  const lifecycle = ownMembership?.lifecycle && {
    lifecycle: ownMembership.lifecycle,
    eventDate: ownMembership.eventDate,
    timezone: ownMembership.timezone,
  };
  // Trocar de perfil com mais de um perfil; Criar outro perfil quando falta o de
  // cerimonialista, a conta não é de vendas e o cadastro de cerimonialista está aberto
  // (Cadastro e perfil RN08; decisões 85 e 308(1)).
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
    ...(me.plannerSignupEnabled &&
    !me.profiles.includes('planner') &&
    !me.profiles.includes('seller')
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
      {...(lifecycle && { status: <LifecycleBadge source={lifecycle} /> })}
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
      navigation={<WeddingNavigation area={AREA} songsEnabled={songsEnabled} />}
    >
      {/* O bloqueio substitui as faixas do ciclo de vida (Bloqueado RN04; 329(4)). */}
      {lifecycle?.lifecycle.blocked && <BlockedBanner />}
      {lifecycle && <LifecycleBanner source={lifecycle} audience="couple" />}
      <Outlet />
    </AppShell>
  );
}
