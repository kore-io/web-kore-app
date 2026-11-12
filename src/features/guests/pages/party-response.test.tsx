import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { meFor, profileUnderTest } from '../../../../tests/profile';
import { apiError, mockApi, renderAreaScreen, renderRoute } from '../../../../tests/render-route';
import type { PartyResponse } from '../../../shared/api/generated/model';

const me = {
  user: { id: 'u1', name: 'Ana Beatriz Moreira', email: 'ana@exemplo.com', platformRole: 'none' },
  activeProfile: 'couple',
  authenticatedAt: '2026-11-05T12:00:00Z',
  memberships: [
    {
      weddingId: 'w1',
      role: 'owner',
      weddingName: 'Ana & Marcos',
      eventDate: '2026-11-14',
      city: 'Campinas',
      state: 'SP',
    },
  ],
  profiles: ['couple'],
  lastProfileOnDevice: 'couple',
  planner: null,
  referrer: null,
};

const guest = (overrides: object) => ({
  ageGroup: 'adult',
  dietaryRestriction: null,
  phone: null,
  email: null,
  phoneMasked: null,
  emailMasked: null,
  rsvpStatus: 'pending',
  tags: [],
  isPlusOne: false,
  ...overrides,
});

function moreira(overrides: Partial<PartyResponse> = {}): PartyResponse {
  return {
    id: 'p1',
    name: 'Família Moreira',
    contactGuestId: null,
    internalNote: null,
    tags: [],
    deliveryStatus: 'responded',
    plusOneSlots: 1,
    link: { url: 'http://localhost:5174/ana-e-marcos/grupo/x', regeneratedAt: null },
    version: 7,
    history: [],
    guests: [
      guest({
        id: 'g1',
        name: 'Célia Moreira',
        rsvpStatus: 'confirmed',
        dietaryRestriction: 'sem glúten',
      }),
      guest({ id: 'g2', name: 'Pedro Moreira', rsvpStatus: 'confirmed' }),
      guest({ id: 'v1', name: null, isPlusOne: true, ageGroup: null }),
    ],
    ...overrides,
  } as PartyResponse;
}

type Call = { method: string; path: string; body: unknown };

function mockPanel({
  party = moreira(),
  response = () => Response.json({ partyId: 'p1', version: 8 }),
}: { party?: PartyResponse; response?: () => Response } = {}) {
  const calls: Call[] = [];
  mockApi(({ method, path, body }) => {
    if (path === '/v1/me') return Response.json(meFor(me));
    if (method === 'GET' && path === '/v1/weddings/w1/parties/p1') return Response.json(party);
    if (method === 'PUT' && path.startsWith('/v1/weddings/w1/guests/')) {
      calls.push({ method, path, body });
      return response();
    }
    if (path.startsWith('/v1/weddings/w1/dashboard')) {
      return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
    }
    if (path.startsWith('/v1/weddings/w1/parties')) {
      return Response.json({ data: [], total: 0, nextCursor: null, summary: null });
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

async function openChange(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('button', { name: `Ações de ${name}` }));
  await user.click(screen.getByRole('menuitem', { name: 'Alterar resposta' }));
  return screen.getByRole('dialog');
}

describe('Alterar resposta pelo casal (Prazo e respostas RN04; Penpot A8)', () => {
  it('o Dialog com a resposta atual; Não vai avisa que a restrição e a música serão apagadas; salva com a version', async () => {
    const user = userEvent.setup();
    const calls = mockPanel();
    renderRoute({ url: '/app/convidados/grupos/p1' });
    const dialog = await openChange(user, 'Célia Moreira');
    expect(dialog).toHaveAccessibleName('Alterar a resposta de Célia Moreira');
    expect(within(dialog).getByRole('radio', { name: 'Vai' })).toBeChecked();
    const diet = within(dialog).getByRole('textbox', { name: 'Restrição alimentar (opcional)' });
    expect(diet).toHaveValue('sem glúten');
    expect(diet).toHaveAttribute('placeholder', 'Ex.: dieta vegetariana, sem lactose');
    expect(diet).toHaveAttribute('maxlength', '200');
    expect(diet).toHaveAccessibleDescription(
      'Conte só o que o buffet precisa saber. Ex.: vegetariano, sem glúten, alergia a amendoim.',
    );
    await user.click(within(dialog).getByRole('radio', { name: 'Não vai' }));
    expect(
      within(dialog).getByText(
        'A restrição alimentar e a música sugerida por Célia Moreira serão apagadas.',
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Salvar resposta' }));
    expect(await screen.findByText('Resposta alterada.')).toBeInTheDocument();
    expect(calls).toEqual([
      {
        method: 'PUT',
        path: '/v1/weddings/w1/guests/g1/response',
        body: { status: 'declined', version: 7, dietaryRestriction: null },
      },
    ]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('a vaga: "do acompanhante", Vai pede o nome, e o nome vai no corpo', async () => {
    const user = userEvent.setup();
    const calls = mockPanel();
    renderRoute({ url: '/app/convidados/grupos/p1' });
    const dialog = await openChange(user, 'Acompanhante');
    expect(dialog).toHaveAccessibleName('Alterar a resposta do acompanhante');
    expect(within(dialog).getByRole('button', { name: 'Salvar resposta' })).toBeDisabled();
    await user.click(within(dialog).getByRole('radio', { name: 'Vai' }));
    await user.click(within(dialog).getByRole('button', { name: 'Salvar resposta' }));
    const name = within(dialog).getByRole('textbox', { name: 'Nome do acompanhante' });
    expect(name).toHaveAccessibleDescription('Informem o nome do acompanhante.');
    expect(name).toHaveAttribute('maxlength', '80');
    expect(calls).toHaveLength(0);
    await user.type(name, ' Rita Lopes ');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar resposta' }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.body).toEqual({
      status: 'confirmed',
      version: 7,
      dietaryRestriction: null,
      name: 'Rita Lopes',
    });
  });

  it('a cerimonialista lê o erro do nome no singular (198(2))', async () => {
    profileUnderTest.current = 'planner';
    const user = userEvent.setup();
    mockPanel();
    renderAreaScreen({ url: '/app/convidados/grupos/p1' });
    const dialog = await openChange(user, 'Acompanhante');
    await user.click(within(dialog).getByRole('radio', { name: 'Vai' }));
    await user.click(within(dialog).getByRole('button', { name: 'Salvar resposta' }));
    expect(
      within(dialog).getByRole('textbox', { name: 'Nome do acompanhante' }),
    ).toHaveAccessibleDescription('Informe o nome do acompanhante.');
  });

  it('o 409 RSVP_CHANGED fecha, recarrega e diz o porquê (decisão 232(7))', async () => {
    const user = userEvent.setup();
    mockPanel({
      response: () =>
        apiError({
          status: 409,
          body: { error: 'RSVP_CHANGED', current: { partyId: 'p1', version: 9 } },
        }),
    });
    renderRoute({ url: '/app/convidados/grupos/p1' });
    const dialog = await openChange(user, 'Pedro Moreira');
    await user.click(within(dialog).getByRole('radio', { name: 'Não vai' }));
    await user.click(within(dialog).getByRole('button', { name: 'Salvar resposta' }));
    expect(
      await screen.findByText(
        'As respostas deste grupo mudaram. O painel agora mostra as respostas atuais: confiram e tentem de novo.',
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('o Dialog é acessível', async () => {
    const user = userEvent.setup();
    mockPanel();
    renderRoute({ url: '/app/convidados/grupos/p1' });
    await openChange(user, 'Célia Moreira');
    await expectNoA11yViolations({ container: document.body, disabledRules: ['region'] });
  });
});

describe('o Histórico do grupo no Painel (Prazo e respostas RN05)', () => {
  it('as linhas da mais nova para a mais antiga, com a hora; vazio, oculto', async () => {
    const at = (day: number, hour: number, minute: number) =>
      new Date(2026, 8, day, hour, minute).toISOString();
    mockPanel({
      party: moreira({
        history: [
          {
            kind: 'response',
            at: at(14, 10, 5),
            actor: 'couple',
            actorName: 'Ana',
            guest: { name: 'Pedro Moreira', status: 'declined' },
          },
          {
            kind: 'response',
            at: at(12, 20, 14),
            actor: 'party',
            signedBy: 'Célia',
            confirmed: 3,
            declined: 0,
          },
          { kind: 'viewed', at: at(11, 9, 0) },
          { kind: 'sent', at: at(10, 18, 30), channel: 'whatsapp' },
        ],
      } as Partial<PartyResponse>),
    });
    const view = renderRoute({ url: '/app/convidados/grupos/p1' });
    const card = (await screen.findByRole('heading', { name: 'Histórico' })).closest(
      'section',
    ) as HTMLElement;
    expect(
      within(card)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Resposta alterada por Ana: Pedro Moreira não vai14/09 às 10h05',
      'Respondido por Célia: 3 confirmados12/09 às 20h14',
      'Convite aberto11/09 às 9h',
      'Convite enviado pelo WhatsApp10/09 às 18h30',
    ]);
    view.unmount();
    mockPanel();
    renderRoute({ url: '/app/convidados/grupos/p1' });
    await screen.findByRole('heading', { name: 'Família Moreira', level: 1 });
    expect(screen.queryByRole('heading', { name: 'Histórico' })).toBeNull();
  });
});
