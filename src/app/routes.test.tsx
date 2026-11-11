import { render } from '@testing-library/react';
import { createMemoryRouter, matchRoutes, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { paths } from './paths';
import { routes } from './routes';

function routeIdAt({ url }: { url: string }) {
  const matches = matchRoutes(routes, url);
  return matches?.at(-1)?.route.id;
}

describe('rotas do app (decisões 139, 146, 147 e 198)', () => {
  it('os caminhos aprovados', () => {
    expect(paths).toEqual({
      signIn: '/entrar',
      signInConfirm: '/entrar/confirmar',
      signInGoogle: '/entrar/google',
      invite: '/convite/:token',
      profiles: '/perfis',
      signUp: '/cadastro',
      sessionExpired: '/sessao-expirada',
      coupleArea: '/app',
      guests: '/app/convidados',
      guestImport: '/app/convidados/importar',
      guestExport: '/app/convidados/exportar',
      guestTags: '/app/convidados/tags',
      guestTrash: '/app/convidados/lixeira',
      guestParty: '/app/convidados/grupos/:partyId',
    });
  });

  it.each([
    ['/entrar?error=google_unverified', 'sign-in'],
    ['/entrar/confirmar?token=abc', 'sign-in-confirm'],
    ['/entrar/google?step=choose_profile&next=%2Fapp', 'sign-in-google'],
    ['/convite/tok_123', 'invite'],
    ['/perfis', 'profiles'],
    ['/cadastro', 'sign-up'],
    ['/sessao-expirada', 'session-expired'],
    ['/app/convidados?resposta=pendentes', 'guests'],
    ['/app/convidados/importar', 'guest-import'],
    ['/app/convidados/exportar', 'guest-export'],
    ['/app/convidados/tags', 'guest-tags'],
    ['/app/convidados/lixeira', 'guest-trash'],
    ['/app/convidados/grupos/0190f3a2-0000-7000-8000-000000000001', 'guest-party'],
    ['/app', 'dashboard'],
  ])('%s abre a rota %s', (url, id) => {
    expect(routeIdAt({ url })).toBe(id);
  });

  it.each(['/', '/caminho-que-nao-existe'])('%s volta para a área do casal', (url) => {
    const router = createMemoryRouter(routes, { initialEntries: [url] });
    render(<RouterProvider router={router} />);
    expect(router.state.location.pathname).toBe('/app');
  });
});
