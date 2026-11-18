import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { apiError, mockApi, renderRoute } from '../../../../tests/render-route';

afterEach(() => {
  vi.unstubAllGlobals();
});

const me = {
  user: { id: 'u1', name: 'Juliana Prado', email: 'juliana@exemplo.com', platformRole: 'none' },
  activeProfile: 'planner',
  authenticatedAt: '2026-11-14T12:00:00Z',
  // O vínculo de w9, que o Montar o site abre (a moldura da colaboradora, D5a).
  memberships: [
    {
      weddingId: 'w9',
      role: 'collaborator',
      weddingName: 'Isabela & André',
      eventDate: '2027-05-08',
      city: 'Americana',
      state: 'SP',
      lifecycle: {
        status: 'draft',
        endDate: null,
        graceUntil: null,
        expiredAt: null,
        deletionScheduledFor: null,
        blocked: false,
      },
    },
  ],
  profiles: ['planner'],
  lastProfileOnDevice: 'planner',
  planner: { organization: 'Prado Assessoria', weddingsCount: 2 },
  referrer: null,
  plannerSignupEnabled: true,
  identities: [{ provider: 'email' }],
};

type Call = { method: string; path: string; body?: unknown };

/** O rascunho recém-criado que ela criou, sem dono e sem convite (RN04). */
const draft = {
  partnerNames: ['Isabela', 'André'],
  eventDate: '2027-05-08',
  status: 'draft',
  rsvpPercent: 0,
  origin: 'created_by_me',
  slug: 'isabela-e-andre',
  stats: { guestsTotal: 0, confirmed: 0, declined: 0, pending: 0 },
  coupleInvitations: [] as object[],
  hasOwner: false,
  canEditIdentity: true,
  weddingId: 'w9',
  city: 'Americana',
  state: 'SP',
  guestsTotal: 0,
  createdByMe: true,
  awaitingPayment: false,
  myMembershipId: 'm9',
  timezone: 'America/Sao_Paulo',
};

const LINK = {
  id: 'i2',
  type: 'link',
  state: 'active',
  url: 'https://kore.com.br/convite/8f3k2m',
  expiresAt: '2026-12-17T15:00:00Z',
};

function api({
  available = true,
  create = () =>
    Response.json(
      { status: 'draft', weddingId: 'w9', slug: 'isabela-e-andre', timezone: 'America/Sao_Paulo' },
      { status: 201 },
    ),
  detail = draft as Record<string, unknown>,
  discountPercent = 10 as number | null,
  invite,
}: {
  available?: boolean;
  create?: () => Response;
  detail?: Record<string, unknown>;
  discountPercent?: number | null;
  invite?: (body: unknown) => Response;
} = {}) {
  const calls: Call[] = [];
  // O detalhe muda depois do envio: aguarda o casal, com o convite.
  let current = detail;
  mockApi(({ method, path, body }) => {
    if (path === '/v1/me') return Response.json(me);
    if (path.startsWith('/v1/weddings/slug-availability')) {
      const slug = new URL(`http://x${path}`).searchParams.get('slug') ?? '';
      return Response.json(
        available
          ? { slug, available: true }
          : { slug, available: false, suggestion: `${slug}-2027` },
      );
    }
    if (method === 'POST' && path === '/v1/me/weddings') {
      calls.push({ method, path, body });
      return create();
    }
    if (path === '/v1/me/referrer') {
      return Response.json({
        referralCode: 'juliana',
        link: 'https://kore.com.br/i/juliana',
        discountPercent,
        taxIdMasked: null,
        pixKeyMasked: null,
        payoutDataComplete: false,
      });
    }
    if (path === '/v1/me/weddings/w9') return Response.json(current);
    if (method === 'POST' && path === '/v1/weddings/w9/access-invitations') {
      calls.push({ method, path, body });
      if (invite) return invite(body);
      const emails = (body as { emails?: string[] }).emails ?? [];
      current = {
        ...current,
        status: 'awaiting_couple',
        coupleInvitations: emails.length
          ? emails.map((email, index) => ({
              id: `i${index}`,
              type: 'email',
              email,
              sentAt: '2026-11-17T15:00:00Z',
              expiresAt: '2026-12-17T15:00:00Z',
            }))
          : [LINK],
      };
      return Response.json(
        {
          invitations: emails.length
            ? emails.map((email, index) => ({
                id: `i${index}`,
                email,
                kind: 'couple',
                expiresAt: '2026-12-17T15:00:00Z',
                resent: false,
              }))
            : [
                {
                  id: 'i2',
                  email: null,
                  kind: 'couple',
                  expiresAt: LINK.expiresAt,
                  resent: false,
                  url: LINK.url,
                },
              ],
        },
        { status: 201 },
      );
    }
    if (method === 'DELETE' && path === '/v1/weddings/w9/access-invitations/i2') {
      calls.push({ method, path, body });
      // A API não volta o status a rascunho ao cancelar o link (fica aguardando o casal).
      current = { ...current, coupleInvitations: [] };
      return new Response(null, { status: 204 });
    }
    if (method !== 'GET') calls.push({ method, path, body });
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

const ROUTE = '/cerimonialista/casamentos/novo';
const INVITE = `${ROUTE}?casamento=w9`;
// O i18n põe um WORD JOINER depois do hífen de "e-mail".
const EMAIL = 'E-\u2060mail do casal (opcional)';
const OTHER_EMAIL = 'Outro e-\u2060mail do casal (opcional)';
const wj = (text: string) => text.replace(/([eE])-mail/g, '$1-\u2060mail');

async function fillData(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByRole('textbox', { name: 'Nome 1 de 2' }), 'Isabela');
  await user.type(screen.getByRole('textbox', { name: 'Nome 2 de 2' }), 'André');
  await user.type(screen.getByRole('textbox', { name: 'Cidade' }), 'Americana');
  await user.selectOptions(screen.getByRole('combobox', { name: 'UF' }), 'SP');
}

describe('Novo casamento › passos 1 e 2 (Novo casamento RN01 a RN04; D6a)', () => {
  it('o passo 1: o stepper, o subtítulo e os erros abaixo de cada campo (RN02)', async () => {
    const user = userEvent.setup();
    api();
    const { container } = renderRoute({ url: ROUTE });
    expect(await screen.findByRole('heading', { name: 'Novo casamento', level: 1 })).toBeVisible();
    expect(
      screen.getByText(
        'Passo 1 de 4 · O casamento nasce como rascunho. Você monta o site e convida o casal quando quiser.',
      ),
    ).toBeInTheDocument();
    const steps = screen.getByRole('list', { name: 'Passos do novo casamento' });
    expect(within(steps).getAllByRole('listitem')).toHaveLength(4);
    expect(within(steps).getByText('Dados do casamento').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    );
    await expectNoA11yViolations({ container });
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByRole('textbox', { name: 'Nome 1 de 2' })).toHaveAccessibleDescription(
      'Informe o nome.',
    );
    expect(screen.getByRole('textbox', { name: 'Nome 2 de 2' })).toHaveAccessibleDescription(
      'Informe o nome.',
    );
    expect(screen.getByRole('textbox', { name: 'Cidade' })).toHaveAccessibleDescription(
      'Informe a cidade.',
    );
    expect(screen.getByRole('combobox', { name: 'UF' })).toHaveAccessibleDescription(
      'Escolha a UF.',
    );
    expect(screen.getByText('Passo 1 de 4', { exact: false })).toBeInTheDocument();
  });

  it('o endereço sugerido pelos nomes, a disponibilidade e o ocupado com a sugestão', async () => {
    const user = userEvent.setup();
    api({ available: false });
    renderRoute({ url: ROUTE });
    await fillData(user);
    const slug = screen.getByRole('textbox', { name: 'Endereço do site' });
    expect(slug).toHaveValue('isabela-e-andre');
    expect(
      await screen.findByText('Esse endereço já está em uso. Tente isabela-e-andre-2027.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    // Ocupado: não avança.
    expect(screen.getByText('Passo 1 de 4', { exact: false })).toBeInTheDocument();
  });

  it('passo 1 → passo 2 → o POST com a aparência padrão e o passo 3, sem o Toast (RN04; decisão 281)', async () => {
    const user = userEvent.setup();
    const calls = api();
    const { router } = renderRoute({ url: ROUTE });
    await fillData(user);
    await user.click(screen.getByRole('checkbox', { name: 'O casal ainda não sabe a data' }));
    expect(
      await screen.findByText('Endereço disponível. Dá para mudar até publicar.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(
      await screen.findByText(
        'Passo 2 de 4 · Escolha um ponto de partida. Dá para mudar tudo depois, no Editor do site.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Dados do casamento, concluído')).toBeInTheDocument();
    expect(
      within(screen.getByRole('complementary', { name: 'Prévia do site' })).getByText(
        'Isabela & André',
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Criar casamento' }));
    await waitFor(() => expect(router.state.location.search).toBe('?casamento=w9'));
    expect(router.state.location.pathname).toBe(ROUTE);
    expect(
      await screen.findByText(
        'Passo 3 de 4 · O casamento já está criado como rascunho. Convide o casal agora ou deixe para depois.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Casamento criado.')).toBeNull();
    expect(calls).toEqual([
      {
        method: 'POST',
        path: '/v1/me/weddings',
        body: {
          partner1Name: 'Isabela',
          partner2Name: 'André',
          city: 'Americana',
          state: 'SP',
          slug: 'isabela-e-andre',
          appearance: {
            fontPairKey: 'romantico',
            starterPaletteKey: 'terracota',
            primaryColor: '#A94F37',
            accentColor: '#7A8B69',
            backgroundMode: 'cream',
          },
        },
      },
    ]);
  });

  it('o endereço ocupado na criação (409 SLUG_UNAVAILABLE) volta ao passo 1 com a sugestão', async () => {
    const user = userEvent.setup();
    api({
      create: () =>
        apiError({
          status: 409,
          body: { error: 'SLUG_UNAVAILABLE', suggestion: 'isabela-e-andre-2' },
        }),
    });
    renderRoute({ url: ROUTE });
    await fillData(user);
    await screen.findByText('Endereço disponível. Dá para mudar até publicar.');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await screen.findByText('Passo 2 de 4', { exact: false });
    await user.click(screen.getByRole('button', { name: 'Criar casamento' }));
    expect(
      await screen.findByText('Esse endereço já está em uso. Tente isabela-e-andre-2.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Passo 1 de 4', { exact: false })).toBeInTheDocument();
  });

  it('o contraste recusado pelo servidor (422 CONTRAST_TOO_LOW) fica no passo 2 com o aviso', async () => {
    const user = userEvent.setup();
    api({
      create: () =>
        apiError({ status: 422, body: { error: 'CONTRAST_TOO_LOW', check: 'primary_foreground' } }),
    });
    renderRoute({ url: ROUTE });
    await fillData(user);
    await screen.findByText('Endereço disponível. Dá para mudar até publicar.');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await screen.findByText('Passo 2 de 4', { exact: false });
    await user.click(screen.getByRole('button', { name: 'Criar casamento' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Passo 2 de 4', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar casamento' })).toBeDisabled();
  });

  it('Cancelar volta a Meus casamentos sem criar nada', async () => {
    const user = userEvent.setup();
    const calls = api();
    const { router } = renderRoute({ url: ROUTE });
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/cerimonialista'));
    expect(calls).toEqual([]);
  });

  it('os nomes e a cidade com mais de 80 caracteres (RN02)', async () => {
    const user = userEvent.setup();
    api();
    renderRoute({ url: ROUTE });
    const name = await screen.findByRole('textbox', { name: 'Nome 1 de 2' });
    await user.click(name);
    await user.paste('a'.repeat(81));
    const city = screen.getByRole('textbox', { name: 'Cidade' });
    await user.click(city);
    await user.paste('b'.repeat(81));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(name).toHaveAccessibleDescription('O nome passa de 80 caracteres.');
    expect(city).toHaveAccessibleDescription('A cidade passa de 80 caracteres.');
  });

  it('o Continuar do passo 1 espera a resposta da disponibilidade do endereço', async () => {
    const user = userEvent.setup();
    api();
    renderRoute({ url: ROUTE });
    await fillData(user);
    // Antes da resposta (o debounce de 400 ms), não avança e o botão avisa que espera.
    expect(screen.getByRole('button', { name: 'Continuar' })).toHaveAttribute('aria-busy', 'true');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByText('Passo 1 de 4', { exact: false })).toBeInTheDocument();
    await screen.findByText('Endereço disponível. Dá para mudar até publicar.');
    expect(screen.getByRole('button', { name: 'Continuar' })).not.toHaveAttribute('aria-busy');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('Passo 2 de 4', { exact: false })).toBeInTheDocument();
  });

  it('a falha na criação mostra o aviso genérico e fica no passo 2', async () => {
    const user = userEvent.setup();
    api({ create: () => apiError({ status: 503, body: { error: 'UNAVAILABLE' } }) });
    renderRoute({ url: ROUTE });
    await fillData(user);
    await screen.findByText('Endereço disponível. Dá para mudar até publicar.');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await screen.findByText('Passo 2 de 4', { exact: false });
    await user.click(screen.getByRole('button', { name: 'Criar casamento' }));
    expect(
      await screen.findByText('Não foi possível continuar. Confira sua conexão e tente de novo.', {
        exact: false,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Passo 2 de 4', { exact: false })).toBeInTheDocument();
  });
});

describe('Novo casamento › passos 3 e 4 (Novo casamento RN05 a RN07; D6b; decisões 280 e 281)', () => {
  it('o passo 3: os campos, o aviso do desconto e Gerar link sem e-mail; sem o Voltar', async () => {
    api();
    const { container } = renderRoute({ url: INVITE });
    expect(await screen.findByRole('textbox', { name: EMAIL })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Passo 3 de 4 · O casamento já está criado como rascunho. Convide o casal agora ou deixe para depois.',
      ),
    ).toBeInTheDocument();
    const steps = screen.getByRole('list', { name: 'Passos do novo casamento' });
    expect(within(steps).getByText('Convidar o casal').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getByText('Aparência, concluído')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: EMAIL })).toHaveAccessibleDescription(
      wj('Sem e-mail: você manda o link ao casal pelo WhatsApp.'),
    );
    expect(screen.getByRole('textbox', { name: OTHER_EMAIL })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Mensagem (opcional)' })).toBeInTheDocument();
    expect(
      await screen.findByText('O casal ganha 10% de desconto na ativação.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gerar link' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Convidar depois' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Voltar' })).toBeNull();
    await expectNoA11yViolations({ container });
  });

  it('sem desconto, o aviso não aparece', async () => {
    api({ discountPercent: null });
    renderRoute({ url: INVITE });
    await screen.findByRole('button', { name: 'Gerar link' });
    await waitFor(() => expect(screen.queryByText(/de desconto na ativação/)).toBeNull());
  });

  it('Enviar convite com os dois e-mails e a mensagem: o POST e o Pronto com convite', async () => {
    const user = userEvent.setup();
    const calls = api();
    const { router } = renderRoute({ url: INVITE });
    await user.type(await screen.findByRole('textbox', { name: EMAIL }), 'isabela@exemplo.com');
    await user.type(screen.getByRole('textbox', { name: OTHER_EMAIL }), 'andre@exemplo.com');
    await user.type(
      screen.getByRole('textbox', { name: 'Mensagem (opcional)' }),
      'Oi, Isabela e André!',
    );
    await user.click(screen.getByRole('button', { name: 'Enviar convite' }));
    expect(await screen.findByRole('heading', { name: 'Casamento criado.' })).toBeInTheDocument();
    expect(screen.getByText('Passo 4 de 4 · Pronto')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Enviamos o convite para isabela@exemplo.com e andre@exemplo.com. Enquanto o casal não aceita, você já pode montar o site e a lista de convidados.',
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText('Aguardando o casal')).toBeInTheDocument();
    expect(
      screen.getByText('Isabela e André · sáb., 8 de mai. de 2027 · Americana (SP)'),
    ).toBeInTheDocument();
    const next = screen.getByRole('region', { name: 'Próximos passos' });
    expect(
      within(next)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Montar o site: seções, fotos e lista de presentes',
      'Cadastrar os convidados, à mão ou pela planilha',
      'Acompanhar em Meus casamentos quando o casal aceitar',
    ]);
    expect(calls.at(-1)).toEqual({
      method: 'POST',
      path: '/v1/weddings/w9/access-invitations',
      body: {
        kind: 'couple',
        emails: ['isabela@exemplo.com', 'andre@exemplo.com'],
        message: 'Oi, Isabela e André!',
      },
    });
    await user.click(screen.getByRole('button', { name: 'Ir para Meus casamentos' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/cerimonialista'));
  });

  it('Gerar link: o POST sem e-mail e o Pronto com o bloco Link para o casal e o WhatsApp da RN06', async () => {
    const user = userEvent.setup();
    const calls = api();
    renderRoute({ url: INVITE });
    // A mensagem não vai sem e-mail (RN05).
    await user.type(await screen.findByRole('textbox', { name: 'Mensagem (opcional)' }), 'Oi!');
    await user.click(screen.getByRole('button', { name: 'Gerar link' }));
    expect(await screen.findByRole('heading', { name: 'Casamento criado.' })).toBeInTheDocument();
    const block = await screen.findByRole('region', { name: 'Link para o casal' });
    expect(within(block).getByRole('textbox', { name: 'Link para o casal' })).toHaveValue(
      'kore.com.br/convite/8f3k2m',
    );
    const open = vi.fn();
    vi.stubGlobal('open', open);
    await user.click(within(block).getByRole('button', { name: 'Compartilhar no WhatsApp' }));
    expect(open).toHaveBeenCalledWith(
      `https://wa.me/?text=${encodeURIComponent(
        'Oi! Montei o site de vocês e já dá para começar a lista de convidados: https://kore.com.br/convite/8f3k2m',
      )}`,
      '_blank',
      'noopener',
    );
    expect(calls.at(-1)).toEqual({
      method: 'POST',
      path: '/v1/weddings/w9/access-invitations',
      body: { kind: 'couple' },
    });
  });

  it('o Pronto mostra o link da resposta do POST, sem esperar a releitura do detalhe (sugestão do Crivo)', async () => {
    const user = userEvent.setup();
    // O detalhe relido continua sem o link (a releitura atrasada ou com falha).
    api({
      invite: () =>
        Response.json(
          {
            invitations: [
              {
                id: 'i2',
                email: null,
                kind: 'couple',
                expiresAt: LINK.expiresAt,
                resent: false,
                url: LINK.url,
              },
            ],
          },
          { status: 201 },
        ),
    });
    renderRoute({ url: INVITE });
    await user.click(await screen.findByRole('button', { name: 'Gerar link' }));
    const block = await screen.findByRole('region', { name: 'Link para o casal' });
    expect(within(block).getByRole('textbox', { name: 'Link para o casal' })).toHaveValue(
      'kore.com.br/convite/8f3k2m',
    );
  });

  it('Cancelar o link no Pronto deixa o Pronto como o sem convite, com o Convidar o casal (sugestão do Crivo)', async () => {
    const user = userEvent.setup();
    const calls = api();
    renderRoute({ url: INVITE });
    await user.click(await screen.findByRole('button', { name: 'Gerar link' }));
    const block = await screen.findByRole('region', { name: 'Link para o casal' });
    await user.click(within(block).getByRole('button', { name: 'Cancelar link' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Cancelar o link do casal?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar link' }));
    expect(
      await screen.findByText(
        'O convite para o casal fica para depois. Envie quando quiser, no detalhe do casamento.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Link para o casal' })).toBeNull();
    expect(screen.queryByText('Acompanhar em Meus casamentos quando o casal aceitar')).toBeNull();
    expect(calls.at(-1)).toMatchObject({
      method: 'DELETE',
      path: '/v1/weddings/w9/access-invitations/i2',
    });
    await user.click(screen.getByRole('button', { name: 'Convidar o casal' }));
    expect(await screen.findByRole('button', { name: 'Gerar link' })).toBeInTheDocument();
  });

  it('Convidar depois: o Pronto em Rascunho, e Convidar o casal volta ao passo 3 (RN06)', async () => {
    const user = userEvent.setup();
    const calls = api();
    const { router } = renderRoute({ url: INVITE });
    await user.click(await screen.findByRole('button', { name: 'Convidar depois' }));
    expect(await screen.findByRole('heading', { name: 'Casamento criado.' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'O convite para o casal fica para depois. Envie quando quiser, no detalhe do casamento.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Rascunho')).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Próximos passos' })).getAllByRole('listitem'),
    ).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Ir para Meus casamentos' })).toBeNull();
    expect(calls).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Convidar o casal' }));
    expect(
      await screen.findByText(
        'Passo 3 de 4 · O casamento já está criado como rascunho. Convide o casal agora ou deixe para depois.',
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Convidar depois' }));
    await user.click(await screen.findByRole('button', { name: 'Montar o site' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(/^\/cerimonialista\/casamentos\/w9\/site/),
    );
  });

  it('os erros: o e-mail inválido, o próprio e-mail e a mensagem com mais de 500 caracteres', async () => {
    const user = userEvent.setup();
    const calls = api();
    renderRoute({ url: INVITE });
    const email = await screen.findByRole('textbox', { name: EMAIL });
    await user.type(email, 'isabela@');
    await user.type(screen.getByRole('textbox', { name: OTHER_EMAIL }), 'juliana@exemplo.com');
    const message = screen.getByRole('textbox', { name: 'Mensagem (opcional)' });
    await user.click(message);
    await user.paste('a'.repeat(501));
    await user.click(screen.getByRole('button', { name: 'Enviar convite' }));
    expect(email).toHaveAccessibleDescription(wj('Informe um e-mail válido.'));
    expect(screen.getByRole('textbox', { name: OTHER_EMAIL })).toHaveAccessibleDescription(
      wj('Este é o e-mail da sua conta. Use o e-mail do casal.'),
    );
    expect(message).toHaveAccessibleDescription('A mensagem passa de 500 caracteres.');
    expect(calls).toEqual([]);
  });

  it('o 422 SELF_INVITATION (um e-mail de outra forma de entrar da conta) fica no campo', async () => {
    const user = userEvent.setup();
    api({ invite: () => apiError({ status: 422, body: { error: 'SELF_INVITATION' } }) });
    renderRoute({ url: INVITE });
    const email = await screen.findByRole('textbox', { name: EMAIL });
    await user.type(email, 'juliana.prado@exemplo.com');
    await user.click(screen.getByRole('button', { name: 'Enviar convite' }));
    await waitFor(() =>
      expect(email).toHaveAccessibleDescription(
        wj('Este é o e-mail da sua conta. Use o e-mail do casal.'),
      ),
    );
    expect(
      screen.getByText(
        'Passo 3 de 4 · O casamento já está criado como rascunho. Convide o casal agora ou deixe para depois.',
      ),
    ).toBeInTheDocument();
  });

  it.each([
    ['com convite pendente', { status: 'awaiting_couple' }],
    ['com dono', { hasOwner: true, status: 'published' }],
    ['de outra pessoa', { createdByMe: false }],
  ])('o casamento %s leva ao detalhe (RN07; decisão 281(3))', async (_, overrides) => {
    api({ detail: { ...draft, ...overrides } });
    const { router } = renderRoute({ url: INVITE });
    await waitFor(() => expect(router.state.location.pathname).toBe('/cerimonialista'));
    expect(router.state.location.search).toBe('?casamento=w9');
  });
});
