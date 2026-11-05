import { Navigate, type RouteObject } from 'react-router';
import { InvitePage } from '../features/access/pages/invite-page';
import { ProfilesPage } from '../features/access/pages/profiles-page';
import { SessionExpiredPage } from '../features/access/pages/session-expired-page';
import { SignInConfirmPage } from '../features/access/pages/sign-in-confirm-page';
import { SignInGooglePage } from '../features/access/pages/sign-in-google-page';
import { SignInPage } from '../features/access/pages/sign-in-page';
import { SignUpPage } from '../features/access/pages/sign-up-page';
import { DashboardPage } from '../features/dashboard/pages/dashboard-page';
import { paths } from './paths';

export const routes: RouteObject[] = [
  { path: '/', element: <Navigate to={paths.coupleArea} replace /> },
  { id: 'sign-in', path: paths.signIn, element: <SignInPage /> },
  { id: 'sign-in-confirm', path: paths.signInConfirm, element: <SignInConfirmPage /> },
  { id: 'sign-in-google', path: paths.signInGoogle, element: <SignInGooglePage /> },
  { id: 'invite', path: paths.invite, element: <InvitePage /> },
  { id: 'profiles', path: paths.profiles, element: <ProfilesPage /> },
  { id: 'sign-up', path: paths.signUp, element: <SignUpPage /> },
  { id: 'session-expired', path: paths.sessionExpired, element: <SessionExpiredPage /> },
  { id: 'couple-area', path: paths.coupleArea, element: <DashboardPage /> },
  // Sem página de "não encontrado" no DS: o caminho desconhecido volta para a área.
  { path: '*', element: <Navigate to={paths.coupleArea} replace /> },
];
