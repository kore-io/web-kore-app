import { createBrowserRouter, RouterProvider } from 'react-router';
import { routes } from './routes';

const router = createBrowserRouter(routes);

/** Raiz do app. Provedores e layout entram nos próximos PRs da Fase 0. */
export function App() {
  return <RouterProvider router={router} />;
}
