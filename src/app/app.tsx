import { QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { createQueryClient } from './query-client';
import { routes } from './routes';

const router = createBrowserRouter(routes);
const queryClient = createQueryClient();

/** Raiz do app: o cache dos dados da API (TanStack Query) e as rotas. */
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
