import { Outlet } from 'react-router';
import { useCaptureArrival } from '../features/access/hooks/use-capture-arrival';

/** Raiz das rotas: o que vale em qualquer página (a indicação e a origem da chegada). */
export function AppRoot() {
  useCaptureArrival();
  return <Outlet />;
}
