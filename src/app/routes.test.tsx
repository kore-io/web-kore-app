import { render } from '@testing-library/react';
import { createMemoryRouter, matchRoutes, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { areaPaths, plannerWeddingBase } from './area';
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
      plannerWedding: '/cerimonialista/casamentos/:weddingId',
      plannerArea: '/cerimonialista',
      plannerNewWedding: '/cerimonialista/casamentos/novo',
      plannerReferral: '/cerimonialista/link-de-indicacao',
      plannerTemplates: '/cerimonialista/modelos',
      plannerNotifications: '/cerimonialista/notificacoes',
      plannerProfile: '/cerimonialista/perfil',
      plannerSettings: '/cerimonialista/configuracoes',
      plannerSettingsAccess: '/cerimonialista/configuracoes/acesso',
      plannerSettingsNotifications: '/cerimonialista/configuracoes/notificacoes',
      plannerSignUp: '/cerimonialista/cadastro',
    });
  });

  it('os caminhos das telas do casamento, a partir do caminho-base (Colaboradora RN09)', () => {
    const { guestParty, guestPartyEdit, siteSection, ...couple } = areaPaths('/app');
    expect(couple).toEqual({
      dashboard: '/app',
      guests: '/app/convidados',
      guestImport: '/app/convidados/importar',
      guestExport: '/app/convidados/exportar',
      guestTags: '/app/convidados/tags',
      guestTrash: '/app/convidados/lixeira',
      guestNew: '/app/convidados/novo',
      deliveries: '/app/envios',
      deliveryInvites: '/app/envios/convites',
      deliverySaveTheDate: '/app/envios/save-the-date',
      deliveryReminder: '/app/envios/lembrete',
      deliveryDeadline: '/app/envios/prazo',
      songs: '/app/musicas',
      notifications: '/app/notificacoes',
      settingsNotifications: '/app/configuracoes/notificacoes',
      site: '/app/site',
    });
    expect(guestParty({ partyId: 'p1' })).toBe('/app/convidados/grupos/p1');
    expect(guestPartyEdit({ partyId: 'p1' })).toBe('/app/convidados/grupos/p1/editar');
    expect(siteSection({ section: 'faq' })).toBe('/app/site/faq');
    const planner = areaPaths(plannerWeddingBase({ weddingId: 'w9' }));
    expect(planner.guests).toBe('/cerimonialista/casamentos/w9/convidados');
    expect(planner.guestParty({ partyId: 'p1' })).toBe(
      '/cerimonialista/casamentos/w9/convidados/grupos/p1',
    );
  });

  it.each([
    ['/cerimonialista/casamentos/w9', 'planner-dashboard'],
    ['/cerimonialista/casamentos/w9/convidados', 'planner-guests'],
    ['/cerimonialista/casamentos/w9/convidados/grupos/p1', 'planner-guest-party'],
    ['/cerimonialista/casamentos/w9/envios/convites', 'planner-delivery-invites'],
    ['/cerimonialista/casamentos/w9/site/dados-basicos', 'planner-site-editor'],
    ['/cerimonialista/casamentos/w9/musicas', 'planner-songs'],
  ])('%s abre a mesma tela na área da colaboradora (%s)', (url, id) => {
    expect(routeIdAt({ url })).toBe(id);
  });

  it.each([
    ['/cerimonialista', 'planner-area-my-weddings'],
    ['/cerimonialista/cadastro', 'planner-sign-up'],
    // O caminho estático do Novo casamento vale sobre o casamento da rota.
    ['/cerimonialista/casamentos/novo', 'planner-area-new-wedding'],
    ['/cerimonialista/link-de-indicacao', 'planner-area-referral'],
    ['/cerimonialista/modelos', 'planner-area-templates'],
    ['/cerimonialista/notificacoes', 'planner-area-notifications'],
    ['/cerimonialista/perfil', 'planner-area-profile'],
    ['/cerimonialista/configuracoes/acesso', 'planner-area-settings-access'],
    ['/cerimonialista/configuracoes/notificacoes', 'planner-area-settings-notifications'],
  ])('%s abre a tela da Área do cerimonialista (%s)', (url, id) => {
    expect(routeIdAt({ url })).toBe(id);
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
