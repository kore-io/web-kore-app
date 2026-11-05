import { ToastProvider } from '@kore-io/design';
import { QueryClientProvider } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { createQueryClient } from './query-client';
import { routes } from './routes';

const router = createBrowserRouter(routes);
const queryClient = createQueryClient();

/** Raiz do app: o cache dos dados da API (TanStack Query), os avisos (Toast) e as rotas. */
export function App() {
  const { t } = useTranslation('common');
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider label={t('notifications.label')} dismissLabel={t('notifications.dismiss')}>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  );
}
