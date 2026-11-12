import { Navigate, type RouteObject } from 'react-router';
import { InvitePage } from '../features/access/pages/invite-page';
import { ProfilesPage } from '../features/access/pages/profiles-page';
import { SessionExpiredPage } from '../features/access/pages/session-expired-page';
import { SignInConfirmPage } from '../features/access/pages/sign-in-confirm-page';
import { SignInGooglePage } from '../features/access/pages/sign-in-google-page';
import { SignInPage } from '../features/access/pages/sign-in-page';
import { SignUpPage } from '../features/access/pages/sign-up-page';
import { DashboardPage } from '../features/dashboard/pages/dashboard-page';
import { GuestsLayout } from '../features/guests/pages/guests-layout';
import { GuestsPage } from '../features/guests/pages/guests-page';
import { ExportPage } from '../features/guests/pages/export-page';
import { SiteEditorPage } from '../features/site/pages/site-editor-page';
import { ImportPage } from '../features/guests/pages/import-page';
import { EditPartyPage, NewPartyPage } from '../features/guests/pages/party-form-page';
import { PartyPanelPage } from '../features/guests/pages/party-panel-page';
import { TagsPage } from '../features/guests/pages/tags-page';
import { TrashPage } from '../features/guests/pages/trash-page';
import { AppRoot } from './app-root';
import { CoupleAreaLayout } from './layout/couple-area-layout';
import { FIRST_SECTION_SLUG } from '../features/site/sections';
import { paths, siteSectionPath } from './paths';

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
      { id: 'session-expired', path: paths.sessionExpired, element: <SessionExpiredPage /> },
      {
        id: 'couple-area',
        path: paths.coupleArea,
        element: <CoupleAreaLayout />,
        children: [
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
            element: <Navigate to={siteSectionPath({ section: FIRST_SECTION_SLUG })} replace />,
          },
          { id: 'site-editor', path: 'site/:section', element: <SiteEditorPage /> },
          {
            id: 'guest-party-edit',
            path: 'convidados/grupos/:partyId/editar',
            element: <EditPartyPage />,
          },
        ],
      },
      // Sem página de "não encontrado" no DS: o caminho desconhecido volta para a área.
      { path: '*', element: <Navigate to={paths.coupleArea} replace /> },
    ],
  },
];
