import { Outlet } from 'react-router';
import { useCaptureReferral } from '../features/access/hooks/use-capture-referral';

/** Raiz das rotas: o que vale em qualquer página (o código de indicação da URL). */
export function AppRoot() {
  useCaptureReferral();
  return <Outlet />;
}
