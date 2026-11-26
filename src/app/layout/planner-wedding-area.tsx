import { NavItem, useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useNavigate, useParams } from 'react-router';
import { usePlannerSession } from '../../features/planner/hooks/use-planner-session';
import { AwaitingCoupleBanner } from '../../features/planner/layout/awaiting-couple-banner';
import { usePlannerShell } from '../../features/planner/layout/use-planner-shell';
import { WeddingSwitcher } from '../../features/planner/layout/wedding-switcher';
import { useSetActiveProfile } from '../../features/access/api/me-active-profile';
import { getMeControllerMeV1QueryKey } from '../../shared/api/generated/me/me';
import { useSiteControllerGetV1 } from '../../shared/api/generated/site/site';
import { ApiError, apiErrorCode } from '../../shared/api/http-client';
import { LoadError } from '../../shared/components/load-error';
import { AreaProvider, areaPaths, plannerWeddingBase } from '../area';
import { paths } from '../paths';
import { AppShell } from './app-shell';
import { BlockedBanner, useWeddingBlockedRefetch } from '../../features/billing/lifecycle/blocked';
import { DeletionBanner } from '../../features/billing/lifecycle/deletion';
import { LifecycleBadge, LifecycleBanner } from '../../features/billing/lifecycle/lifecycle-banner';
import { WeddingNavigation } from './wedding-navigation';

/** A resposta de quem perdeu o vínculo (removida, saiu, casamento excluído): RN01 de Papéis. */
function isWeddingGone(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 404 &&
    apiErrorCode({ error }) === 'WEDDING_NOT_FOUND'
  );
}

/**
 * A colaboradora dentro de um casamento (`/cerimonialista/casamentos/:weddingId`;
 * Colaboradora RN01 a RN07; Penpot 17):
 * - o gate pelo perfil que a conta tem (sem o de cerimonialista, vai a /app);
 * - a faixa "Você colabora neste casamento." com Voltar a Meus casamentos, a Sidebar do
 *   casal com Voltar a Meus casamentos no topo (sem as Configurações do casal), a Topbar com
 *   o seletor de casamento (A11), o selo do site, o sino e o menu dela;
 * - a faixa Aguardando o casal (RN04);
 * - a perda de acesso (RN07): o casamento que não está no /me dela, ou qualquer resposta
 *   `404 WEDDING_NOT_FOUND` de uma leitura ou de uma gravação, volta a Meus casamentos com
 *   "Este casamento não está mais disponível."; o de que ela é dona abre em /app.
 */
export function PlannerWeddingArea() {
  const { weddingId = '' } = useParams();
  const { t } = useTranslation('planner');
  const { showToast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { me, failed, retry } = usePlannerSession();
  const shell = usePlannerShell({ me });
  const membership = me?.memberships.find((item) => item.weddingId === weddingId);
  const site = useSiteControllerGetV1(weddingId, {
    query: { enabled: membership?.role === 'collaborator' },
  });
  const leaving = useRef(false);
  const setActiveProfile = useSetActiveProfile();
  const switching = useRef(false);
  useWeddingBlockedRefetch();

  // A perda de acesso, um texto só (RN07): a próxima leitura ou gravação recebe o 404.
  useEffect(() => {
    leaving.current = false;
    const leave = () => {
      if (leaving.current) return;
      leaving.current = true;
      void queryClient.invalidateQueries({ queryKey: getMeControllerMeV1QueryKey() });
      showToast({ tone: 'danger', message: t('myWeddings.detail.unavailable') });
      void navigate(paths.plannerArea, { replace: true });
    };
    const queries = queryClient.getQueryCache().subscribe((event) => {
      if (
        event.type === 'updated' &&
        event.action.type === 'error' &&
        isWeddingGone(event.action.error)
      ) {
        leave();
      }
    });
    const mutations = queryClient.getMutationCache().subscribe((event) => {
      if (
        event.type === 'updated' &&
        event.action.type === 'error' &&
        isWeddingGone(event.action.error)
      ) {
        leave();
      }
    });
    return () => {
      queries();
      mutations();
    };
  }, [weddingId, queryClient, showToast, t, navigate]);

  // Sem vínculo no /me: o casamento não está disponível; o de dona abre na Área do Casal.
  const missing = me !== undefined && !membership;
  const owner = membership?.role === 'owner';
  const activeProfile = me?.activeProfile;
  useEffect(() => {
    if (owner) {
      // A dona abre em /app sem a Seleção de perfil (decisão 268; Colaboradora RN01): o perfil
      // ativo passa a casal, que só guia a navegação (o gate é pelo perfil que a conta tem).
      if (activeProfile === 'couple') {
        void navigate(paths.coupleArea, { replace: true });
        return;
      }
      if (switching.current) return;
      switching.current = true;
      const open = () => {
        void queryClient.resetQueries({ queryKey: getMeControllerMeV1QueryKey() });
        void navigate(paths.coupleArea, { replace: true });
      };
      // Se a troca falhar, o /app leva à Seleção de perfil, que já mostra os dois perfis.
      setActiveProfile.mutate({ data: { profile: 'couple' } }, { onSettled: open });
    } else if (missing && !leaving.current) {
      leaving.current = true;
      showToast({ tone: 'danger', message: t('myWeddings.detail.unavailable') });
      void navigate(paths.plannerArea, { replace: true });
    }
  }, [owner, activeProfile, missing, navigate, showToast, t, queryClient, setActiveProfile]);

  if (failed) return <LoadError onRetry={retry} />;
  if (!me || !membership || membership.role !== 'collaborator') return null;

  const area = areaPaths(plannerWeddingBase({ weddingId }));
  const songQuestion = site.data?.songQuestion as { enabled?: boolean } | undefined;

  return (
    <AreaProvider area={{ base: plannerWeddingBase({ weddingId }), weddingId, kind: 'planner' }}>
      <AppShell
        title={
          <WeddingSwitcher
            weddingId={weddingId}
            title={membership.weddingName}
            memberships={me.memberships}
          />
        }
        {...(membership.lifecycle && {
          status: (
            <LifecycleBadge
              source={{
                lifecycle: membership.lifecycle,
                eventDate: membership.eventDate,
                timezone: membership.timezone,
              }}
            />
          ),
        })}
        user={shell.user}
        activeProfile={shell.activeProfile}
        userMenuGroups={shell.userMenuGroups}
        notifications={shell.notifications}
        navigation={
          <>
            <NavItem asChild icon={<ArrowLeft />}>
              <Link to={paths.plannerArea}>{t('weddingArea.backToWeddings')}</Link>
            </NavItem>
            <WeddingNavigation area={area} songsEnabled={songQuestion?.enabled === true} />
          </>
        }
      >
        {/* Empilhadas: a do bloqueio acima de "Você colabora neste casamento." (Bloqueado RN04). */}
        {membership.lifecycle?.blocked && <BlockedBanner />}
        {membership.lifecycle && (
          <DeletionBanner
            weddingId={weddingId}
            lifecycle={membership.lifecycle}
            audience="planner"
          />
        )}
        <div className="kore-planner-wedding__banner">
          <div>
            <p className="kore-planner-wedding__banner-title">{t('weddingArea.banner')}</p>
            <p className="kore-planner-wedding__banner-text">
              {t('weddingArea.bannerDescription')}
            </p>
          </div>
          <Link className="kore-planner-wedding__banner-link" to={paths.plannerArea}>
            {t('weddingArea.backToWeddings')}
          </Link>
        </div>
        {membership.lifecycle.status === 'awaiting_couple' && (
          <AwaitingCoupleBanner weddingId={weddingId} />
        )}
        {membership.lifecycle && (
          <LifecycleBanner
            source={{
              lifecycle: membership.lifecycle,
              eventDate: membership.eventDate,
              timezone: membership.timezone,
            }}
            audience="planner"
          />
        )}
        <Outlet />
      </AppShell>
    </AreaProvider>
  );
}
