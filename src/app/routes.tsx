import { Navigate, type RouteObject } from 'react-router';
import { InvitePage } from '../features/access/pages/invite-page';
import { ProfilesPage } from '../features/access/pages/profiles-page';
import { SessionExpiredPage } from '../features/access/pages/session-expired-page';
import { SignInConfirmPage } from '../features/access/pages/sign-in-confirm-page';
import { SignInGooglePage } from '../features/access/pages/sign-in-google-page';
import { SignInPage } from '../features/access/pages/sign-in-page';
import { SignUpPage } from '../features/access/pages/sign-up-page';
import { PlannerAreaLayout } from '../features/planner/layout/planner-area-layout';
import { PlannerAccessSettingsPage } from '../features/planner/pages/planner-access-settings-page';
import { PlannerProfilePage } from '../features/planner/pages/planner-profile-page';
import { PlannerSettingsLayout } from '../features/planner/pages/planner-settings-layout';
import { PlannerSignUpPage } from '../features/planner/pages/planner-sign-up-page';
import { DashboardPage } from '../features/dashboard/pages/dashboard-page';
import { DeadlinePage } from '../features/deliveries/pages/deadline-page';
import { DeliveriesLayout } from '../features/deliveries/pages/deliveries-layout';
import { SendPage } from '../features/deliveries/pages/send-page';
import { GuestsLayout } from '../features/guests/pages/guests-layout';
import { GuestsPage } from '../features/guests/pages/guests-page';
import { ExportPage } from '../features/guests/pages/export-page';
import { SiteEditorPage } from '../features/site/pages/site-editor-page';
import { SongsPage } from '../features/songs/pages/songs-page';
import { NotificationSettingsPage } from '../features/notifications/pages/notification-settings-page';
import { NotificationsPage } from '../features/notifications/pages/notifications-page';
import { ImportPage } from '../features/guests/pages/import-page';
import { EditPartyPage, NewPartyPage } from '../features/guests/pages/party-form-page';
import { PartyPanelPage } from '../features/guests/pages/party-panel-page';
import { TagsPage } from '../features/guests/pages/tags-page';
import { TrashPage } from '../features/guests/pages/trash-page';
import { AppRoot } from './app-root';
import { CoupleAreaLayout } from './layout/couple-area-layout';
import { FIRST_SECTION_SLUG } from '../features/site/sections';
import { PlannerWeddingArea } from './layout/planner-wedding-area';
import { paths } from './paths';

/**
 * As telas do casamento, com caminhos relativos ao caminho-base da área (Colaboradora
 * RN09): montadas em `/app` (o casal) e em `/cerimonialista/casamentos/:weddingId` (a
 * colaboradora). O `prefix` deixa os ids das rotas únicos.
 */
function areaRoutes({ prefix }: { prefix: 'couple' | 'planner' }): RouteObject[] {
  const routes: RouteObject[] = [
    { id: 'dashboard', index: true, element: <DashboardPage /> },
    {
      path: 'convidados',
      element: <GuestsLayout />,
      children: [
        { id: 'guests', index: true, element: <GuestsPage /> },
        { id: 'guest-import', path: 'importar', element: <ImportPage /> },
        { id: 'guest-export', path: 'exportar', element: <ExportPage /> },
        { id: 'guest-tags', path: 'tags', element: <TagsPage /> },
        { id: 'guest-trash', path: 'lixeira', element: <TrashPage /> },
      ],
    },
    { id: 'guest-party', path: 'convidados/grupos/:partyId', element: <PartyPanelPage /> },
    { id: 'guest-new', path: 'convidados/novo', element: <NewPartyPage /> },
    {
      id: 'site',
      path: 'site',
      element: <Navigate to={FIRST_SECTION_SLUG} replace />,
    },
    { id: 'site-editor', path: 'site/:section', element: <SiteEditorPage /> },
    { id: 'songs', path: 'musicas', element: <SongsPage /> },
    { id: 'notifications', path: 'notificacoes', element: <NotificationsPage /> },
    {
      id: 'settings-notifications',
      path: 'configuracoes/notificacoes',
      element: <NotificationSettingsPage />,
    },
    {
      path: 'envios',
      element: <DeliveriesLayout />,
      children: [
        // Envios abre em Enviar convites (decisão 235).
        { index: true, element: <Navigate to="convites" replace /> },
        { id: 'delivery-invites', path: 'convites', element: <SendPage kind="invite" /> },
        {
          id: 'delivery-save-the-date',
          path: 'save-the-date',
          element: <SendPage kind="save_the_date" />,
        },
        { id: 'delivery-reminder', path: 'lembrete', element: <SendPage kind="reminder" /> },
        { id: 'delivery-deadline', path: 'prazo', element: <DeadlinePage /> },
      ],
    },
    {
      id: 'guest-party-edit',
      path: 'convidados/grupos/:partyId/editar',
      element: <EditPartyPage />,
    },
  ];
  return prefix === 'couple' ? routes : withIdPrefix({ routes, prefix });
}

/** Os ids da área da colaboradora levam o prefixo (os do casal ficam como eram). */
function withIdPrefix({
  routes,
  prefix,
}: {
  routes: RouteObject[];
  prefix: string;
}): RouteObject[] {
  return routes.map((route) => ({
    ...route,
    ...(route.id && { id: `${prefix}-${route.id}` }),
    ...(route.children && { children: withIdPrefix({ routes: route.children, prefix }) }),
  })) as RouteObject[];
}

export const routes: RouteObject[] = [
  {
    element: <AppRoot />,
    children: [
      { path: '/', element: <Navigate to={paths.coupleArea} replace /> },
      { id: 'sign-in', path: paths.signIn, element: <SignInPage /> },
      { id: 'sign-in-confirm', path: paths.signInConfirm, element: <SignInConfirmPage /> },
      { id: 'sign-in-google', path: paths.signInGoogle, element: <SignInGooglePage /> },
      { id: 'invite', path: paths.invite, element: <InvitePage /> },
      { id: 'profiles', path: paths.profiles, element: <ProfilesPage /> },
      { id: 'sign-up', path: paths.signUp, element: <SignUpPage /> },
      { id: 'planner-sign-up', path: paths.plannerSignUp, element: <PlannerSignUpPage /> },
      {
        // A Área do cerimonialista (Cadastro e perfil RN07): a moldura, o Meu perfil e as
        // Configurações (D3). As outras telas chegam nos PRs seguintes; até lá, ficam em
        // branco dentro da moldura (decisões 250(d) e 254).
        id: 'planner-area',
        path: paths.plannerArea,
        element: <PlannerAreaLayout />,
        children: [
          { id: 'planner-area-my-weddings', index: true, element: null },
          { id: 'planner-area-new-wedding', path: 'casamentos/novo', element: null },
          { id: 'planner-area-referral', path: 'link-de-indicacao', element: null },
          { id: 'planner-area-templates', path: 'modelos', element: null },
          { id: 'planner-area-notifications', path: 'notificacoes', element: null },
          { id: 'planner-area-profile', path: 'perfil', element: <PlannerProfilePage /> },
          {
            id: 'planner-area-settings',
            path: 'configuracoes',
            element: <PlannerSettingsLayout />,
            children: [
              { index: true, element: <Navigate to="acesso" replace /> },
              {
                id: 'planner-area-settings-access',
                path: 'acesso',
                element: <PlannerAccessSettingsPage />,
              },
              { id: 'planner-area-settings-notifications', path: 'notificacoes', element: null },
            ],
          },
        ],
      },
      { id: 'session-expired', path: paths.sessionExpired, element: <SessionExpiredPage /> },
      {
        id: 'couple-area',
        path: paths.coupleArea,
        element: <CoupleAreaLayout />,
        children: areaRoutes({ prefix: 'couple' }),
      },
      {
        // A colaboradora dentro do casamento (Colaboradora RN01, RN09): as mesmas telas,
        // com o casamento da rota. A moldura dela (faixa, seletor, Voltar) vem no D5.
        id: 'planner-wedding',
        path: paths.plannerWedding,
        element: <PlannerWeddingArea />,
        children: areaRoutes({ prefix: 'planner' }),
      },
      // Sem página de "não encontrado" no DS: o caminho desconhecido volta para a área.
      { path: '*', element: <Navigate to={paths.coupleArea} replace /> },
    ],
  },
];
