import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18next from 'i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { apiError, mockApi, renderRoute } from '../../../../tests/render-route';
import type { PartyResponse } from '../../../shared/api/generated/model';
import { fieldErrorText } from '../components/party-form';
import type { FieldError } from '../party-form';

afterEach(() => {
  vi.unstubAllGlobals();
});

function meAs(profile: 'couple' | 'planner') {
  return {
    user: {
      id: 'u1',
      name: 'Ana Beatriz Moreira',
      email: 'ana.moreira@gmail.com',
      platformRole: 'none',
    },
    activeProfile: profile,
    authenticatedAt: '2026-11-05T12:00:00Z',
    memberships: [
      {
        weddingId: 'w1',
        role: profile === 'couple' ? 'owner' : 'collaborator',
        weddingName: 'Ana & Marcos',
        eventDate: '2026-11-14',
        city: 'Campinas',
        state: 'SP',
      },
    ],
    profiles: [profile],
    lastProfileOnDevice: profile,
    planner: null,
    referrer: null,
  };
}

const tags = [
  { id: 't1', name: 'Família da Ana', color: 'wine', guests: 3 },
  { id: 't2', name: 'Padrinhos', color: 'champagne', guests: 0 },
];

const moreira = {
  id: 'p1',
  name: 'Família Moreira',
  contactGuestId: 'g2',
  internalNote: 'chegam no sábado',
  plusOneSlots: 1,
  deliveryStatus: 'not_sent',
  tags: [{ id: 't1', name: 'Família da Ana', color: 'wine' }],
  history: [],
  link: { url: 'https://kore.com.br/c/abc', regeneratedAt: null },
  guests: [
    {
      id: 'g1',
      name: 'Luiz Moreira',
      ageGroup: 'adult',
      dietaryRestriction: null,
      phone: null,
      email: null,
      phoneMasked: null,
      emailMasked: null,
      rsvpStatus: 'pending',
      tags: [],
      isPlusOne: false,
    },
    {
      id: 'g2',
      name: 'Célia Moreira',
      ageGroup: 'adult',
      dietaryRestriction: 'sem glúten',
      phone: '+5519998763310',
      email: 'celia@exemplo.com',
      phoneMasked: '(19) 9****-3310',
      emailMasked: 'ce***@exemplo.com',
      rsvpStatus: 'confirmed',
      tags: [],
      isPlusOne: false,
    },
    {
      id: 'g3',
      name: null,
      ageGroup: null,
      dietaryRestriction: null,
      phone: null,
      email: null,
      phoneMasked: null,
      emailMasked: null,
      rsvpStatus: 'pending',
      tags: [],
      isPlusOne: true,
    },
  ],
} as unknown as PartyResponse;

type Call = { method: string; path: string; body: unknown };

function mockParties({
  profile = 'couple',
  create = () => Response.json({ id: 'p9' }, { status: 201 }),
  update = () => Response.json(moreira),
}: {
  profile?: 'couple' | 'planner';
  create?: () => Response;
  update?: () => Response;
} = {}) {
  const calls: Call[] = [];
  mockApi(({ method, path, body }) => {
    if (path === '/v1/me') return Response.json(meAs(profile));
    if (path === '/v1/weddings/w1/tags') return Response.json({ limit: 10, data: tags });
    if (method === 'GET' && path === '/v1/weddings/w1/parties/p1') return Response.json(moreira);
    if (method === 'GET' && path.startsWith('/v1/weddings/w1/parties')) {
      return Response.json({
        summary: { guests: 3, namedGuests: 2, parties: 1, confirmed: 1, declined: 0, pending: 2 },
        total: 1,
        data: [],
        nextCursor: null,
      });
    }
    calls.push({ method, path, body });
    if (method === 'POST' && path === '/v1/weddings/w1/parties') return create();
    if (method === 'PATCH' && path === '/v1/weddings/w1/parties/p1') return update();
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

/** O i18n põe um WORD JOINER depois do hífen de "e-mail" (não quebra a linha). */
const EMAIL = 'E-\u2060mail';

const guestCards = () =>
  within(screen.getByRole('group', { name: 'Convidados' })).getAllByRole('textbox', {
    name: 'Nome',
  });

describe('Convidados › Novo grupo (Grupos e convidados RN03 a RN07; decisão 213)', () => {
  it('o formulário do Penpot: voltar, título, os campos, as vagas e as tags', async () => {
    mockParties();
    renderRoute({ url: '/app/convidados/novo' });
    expect(await screen.findByRole('heading', { name: 'Novo grupo' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '‹ Voltar para Convidados' })).toHaveAttribute(
      'href',
      '/app/convidados',
    );
    expect(
      screen.getByText(
        'O convite vai para o convidado de contato, e o grupo responde por todos no mesmo link.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nome do grupo' })).toHaveValue('');
    expect(guestCards()).toHaveLength(1);
    expect(screen.getByRole('combobox', { name: 'Faixa etária' })).toHaveValue('adult');
    expect(
      within(screen.getByRole('combobox', { name: 'Faixa etária' }))
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Adulto', 'Criança', 'Bebê', 'Sem faixa etária']);
    expect(screen.getByRole('textbox', { name: 'Telefone' })).toHaveAttribute(
      'placeholder',
      '(00) 00000-0000',
    );
    expect(screen.getByRole('textbox', { name: EMAIL })).toHaveAttribute(
      'placeholder',
      'nome@email.com',
    );
    expect(
      screen.getByRole('checkbox', { name: 'Convidado de contato (recebe o convite)' }),
    ).toBeDisabled();
    const plusOnes = screen.getByRole('combobox', { name: 'Vagas de acompanhante' });
    expect(plusOnes).toHaveAccessibleDescription(
      'A vaga aparece no convite como "Acompanhante", sem nome.',
    );
    expect(
      within(plusOnes)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Nenhuma', '1 vaga', '2 vagas', '3 vagas', '4 vagas', '5 vagas']);
    await screen.findByRole('checkbox', { name: 'Padrinhos' });
    expect(
      within(screen.getByRole('group', { name: 'Tags' }))
        .getAllByRole('checkbox')
        .map((box) => box.closest('label')?.textContent),
    ).toEqual(['Família da Ana', 'Padrinhos']);
    expect(
      screen.getByRole('textbox', { name: 'Observação interna (só vocês veem)' }),
    ).toHaveAttribute('placeholder', 'Ex.: chegam de São Paulo no sábado');
  });

  it('salva o grupo com dois convidados, o contato, as vagas e a tag, e volta à lista com "Grupo criado."', async () => {
    const user = userEvent.setup();
    const calls = mockParties();
    const { router } = renderRoute({ url: '/app/convidados/novo' });
    await user.type(
      await screen.findByRole('textbox', { name: 'Nome do grupo' }),
      'Beatriz e Leonardo',
    );
    const [first] = guestCards();
    await user.type(first as HTMLElement, 'Beatriz Lima');
    await user.type(screen.getByRole('textbox', { name: 'Telefone' }), '(19) 99876-1402');
    await user.type(screen.getByRole('textbox', { name: EMAIL }), 'bia.lima@gmail.com');
    await user.click(
      screen.getByRole('checkbox', { name: 'Convidado de contato (recebe o convite)' }),
    );
    await user.click(screen.getByRole('button', { name: '+ Adicionar convidado' }));
    await user.type(guestCards()[1] as HTMLElement, 'Leonardo Castro');
    await user.click(screen.getByRole('button', { name: '+ Adicionar convidado' }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Vagas de acompanhante' }),
      '1 vaga',
    );
    await user.click(await screen.findByRole('checkbox', { name: 'Padrinhos' }));
    await user.click(screen.getByRole('button', { name: 'Salvar grupo' }));
    expect(await screen.findByText('Grupo criado.')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/convidados'));
    expect(calls[0]?.body).toEqual({
      name: 'Beatriz e Leonardo',
      guests: [
        {
          name: 'Beatriz Lima',
          ageGroup: 'adult',
          phone: '(19) 99876-1402',
          email: 'bia.lima@gmail.com',
        },
        { name: 'Leonardo Castro', ageGroup: 'adult' },
      ],
      plusOneSlots: 1,
      tagIds: ['t2'],
      contactIndex: 0,
    });
  });

  it('sem nome não salva: os textos do casal no grupo e no convidado (RN03; 213(3))', async () => {
    const user = userEvent.setup();
    const calls = mockParties();
    renderRoute({ url: '/app/convidados/novo' });
    await user.click(await screen.findByRole('button', { name: 'Salvar grupo' }));
    expect(screen.getByRole('textbox', { name: 'Nome do grupo' })).toHaveAccessibleDescription(
      'Informem o nome do grupo.',
    );
    expect(guestCards()[0]).toHaveAccessibleDescription('Informem o nome do convidado.');
    expect(calls).toHaveLength(0);
  });

  it('o 400 marca o telefone do segundo convidado, com o texto do perfil (RN04)', async () => {
    const user = userEvent.setup();
    mockParties({
      create: () =>
        apiError({
          status: 400,
          body: {
            error: 'Bad Request',
            message: ['x'],
            errors: [{ path: 'guests.1.phone', code: 'PHONE_TOO_SHORT', params: { n: 8 } }],
          },
        }),
    });
    renderRoute({ url: '/app/convidados/novo' });
    await user.type(
      await screen.findByRole('textbox', { name: 'Nome do grupo' }),
      'Beatriz e Leonardo',
    );
    await user.type(guestCards()[0] as HTMLElement, 'Beatriz Lima');
    await user.click(screen.getByRole('button', { name: '+ Adicionar convidado' }));
    await user.type(guestCards()[1] as HTMLElement, 'Leonardo Castro');
    const phones = screen.getAllByRole('textbox', { name: 'Telefone' });
    await user.type(phones[1] as HTMLElement, '9876-1402');
    await user.click(screen.getByRole('button', { name: 'Salvar grupo' }));
    await waitFor(() =>
      expect(screen.getAllByRole('textbox', { name: 'Telefone' })[1]).toHaveAccessibleDescription(
        'O telefone tem 8 números. Usem DDD + número, ex.: (19) 99999-9999.',
      ),
    );
    expect(
      screen.getAllByRole('textbox', { name: 'Telefone' })[0],
    ).not.toHaveAccessibleDescription();
  });

  it('a cerimonialista lê os erros no singular (RN04; 189(5))', () => {
    const t = i18next.getFixedT('pt-BR', 'guests');
    const text = (code: FieldError['code'], field: Parameters<typeof fieldErrorText>[0]['field']) =>
      fieldErrorText({ t, error: { code, params: { n: 8 } }, field, audience: 'planner' });
    expect(text('EMAIL_INVALID', 'email')).toBe('Informe um e-\u2060mail válido.');
    expect(text('PHONE_TOO_SHORT', 'phone')).toBe(
      'O telefone tem 8 números. Use DDD + número, ex.: (19) 99999-9999.',
    );
    expect(text('NAME_MISSING', 'groupName')).toBe('Informe o nome do grupo.');
    expect(text('NAME_MISSING', 'guestName')).toBe('Informe o nome do convidado.');
  });

  it('Cancelar volta à lista sem gravar; o Novo grupo do topo abre o formulário', async () => {
    const user = userEvent.setup();
    const calls = mockParties();
    const { router } = renderRoute({ url: '/app/convidados' });
    await user.click(await screen.findByRole('button', { name: 'Novo grupo' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/convidados/novo'));
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/convidados'));
    expect(calls).toHaveLength(0);
  });

  it('é acessível', async () => {
    mockParties();
    const { container } = renderRoute({ url: '/app/convidados/novo' });
    await screen.findByRole('heading', { name: 'Novo grupo' });
    await screen.findByRole('checkbox', { name: 'Padrinhos' });
    await expectNoA11yViolations({ container });
  });
});

describe('Convidados › Editar grupo (RN09; decisão 213(8))', () => {
  it('abre preenchido, sem a vaga vazia, e salva com o PATCH, voltando ao painel com "Alterações salvas."', async () => {
    const user = userEvent.setup();
    const calls = mockParties();
    const { router } = renderRoute({ url: '/app/convidados/grupos/p1/editar' });
    expect(await screen.findByRole('heading', { name: 'Editar grupo' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nome do grupo' })).toHaveValue('Família Moreira');
    expect(guestCards().map((field) => (field as HTMLInputElement).value)).toEqual([
      'Luiz Moreira',
      'Célia Moreira',
    ]);
    expect(screen.getAllByRole('textbox', { name: 'Telefone' })[1]).toHaveValue('(19) 99876-3310');
    const contacts = screen.getAllByRole('checkbox', {
      name: 'Convidado de contato (recebe o convite)',
    });
    expect(
      contacts.map((box) => [
        (box as HTMLInputElement).checked,
        (box as HTMLInputElement).disabled,
      ]),
    ).toEqual([
      [false, true],
      [true, false],
    ]);
    expect(screen.getByRole('combobox', { name: 'Vagas de acompanhante' })).toHaveValue('1');
    expect(await screen.findByRole('checkbox', { name: 'Família da Ana' })).toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Observação interna (só vocês veem)' })).toHaveValue(
      'chegam no sábado',
    );

    await user.type(guestCards()[0] as HTMLElement, ' Filho');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(await screen.findByText('Alterações salvas.')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/convidados/grupos/p1'));
    expect(calls[0]).toMatchObject({ method: 'PATCH', path: '/v1/weddings/w1/parties/p1' });
    expect((calls[0]?.body as { guests: unknown[] }).guests[0]).toEqual({
      id: 'g1',
      name: 'Luiz Moreira Filho',
      ageGroup: 'adult',
      phone: null,
      email: null,
    });
  });

  it('mudar quem já respondeu pede confirmação; Cancelar não grava (RN09)', async () => {
    const user = userEvent.setup();
    const calls = mockParties();
    renderRoute({ url: '/app/convidados/grupos/p1/editar' });
    const emails = await screen.findAllByRole('textbox', { name: EMAIL });
    await user.clear(emails[1] as HTMLElement);
    await user.type(emails[1] as HTMLElement, 'celia.m@exemplo.com');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Esta pessoa já respondeu. Salvar as alterações mesmo assim?',
    });
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(calls).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Salvar alterações',
      }),
    );
    await waitFor(() => expect(calls).toHaveLength(1));
  });

  it('diminuir vagas com resposta mostra o texto embaixo das vagas (RN07)', async () => {
    const user = userEvent.setup();
    mockParties({
      update: () => apiError({ status: 409, body: { error: 'PLUS_ONES_IN_USE', inUse: 1 } }),
    });
    renderRoute({ url: '/app/convidados/grupos/p1/editar' });
    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Vagas de acompanhante' }),
      'Nenhuma',
    );
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Vagas de acompanhante' }),
      ).toHaveAccessibleDescription('Já há 1 acompanhante com resposta neste grupo.'),
    );
  });

  it('o Editar grupo do painel abre o formulário', async () => {
    const user = userEvent.setup();
    mockParties();
    const { router } = renderRoute({ url: '/app/convidados/grupos/p1' });
    await user.click(await screen.findByRole('button', { name: 'Editar grupo' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/app/convidados/grupos/p1/editar'),
    );
  });

  it('é acessível', async () => {
    mockParties();
    const { container } = renderRoute({ url: '/app/convidados/grupos/p1/editar' });
    await screen.findByRole('heading', { name: 'Editar grupo' });
    await expectNoA11yViolations({ container });
  });
});
