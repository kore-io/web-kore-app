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
      guestNew: '/app/convidados/novo',
      guestPartyEdit: '/app/convidados/grupos/:partyId/editar',
      site: '/app/site',
      songs: '/app/musicas',
      notifications: '/app/notificacoes',
      settingsNotifications: '/app/configuracoes/notificacoes',
      deliveries: '/app/envios',
      deliveryInvites: '/app/envios/convites',
      deliverySaveTheDate: '/app/envios/save-the-date',
      deliveryReminder: '/app/envios/lembrete',
      deliveryDeadline: '/app/envios/prazo',
      siteSection: '/app/site/:section',
      publish: '/app/cobranca/publicar',
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
    ['/app/convidados/novo', 'guest-new'],
    ['/app/convidados/grupos/p1/editar', 'guest-party-edit'],
    ['/app/site', 'site'],
    ['/app/musicas', 'songs'],
    ['/app/notificacoes', 'notifications'],
    ['/app/configuracoes/notificacoes', 'settings-notifications'],
    ['/app/site/dados-basicos', 'site-editor'],
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
