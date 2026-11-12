import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../tests/a11y';
import { apiError, mockApi } from '../../../tests/render-route';
import type { RsvpResponse } from '../../shared/api/generated/model';
import { RsvpPage } from './rsvp-page';

const now = new Date('2026-09-20T12:00:00Z');

function rsvp(overrides: Partial<RsvpResponse> = {}): RsvpResponse {
  return {
    party: { id: 'p1', name: 'Família Nunes', version: 3 },
    guests: [
      {
        id: 'g1',
        name: 'Carla Nunes',
        rsvpStatus: 'pending',
        dietaryRestriction: null,
        songSuggestion: null,
        isPlusOne: false,
      },
      {
        id: 'g2',
        name: 'Rafael Nunes',
        rsvpStatus: 'pending',
        dietaryRestriction: null,
        songSuggestion: null,
        isPlusOne: false,
      },
      {
        id: 'v1',
        name: null,
        rsvpStatus: 'pending',
        dietaryRestriction: null,
        songSuggestion: null,
        isPlusOne: true,
      },
    ],
    rsvpDeadline: '2026-10-15',
    state: 'open',
    songQuestion: { enabled: true, text: 'Que música não pode faltar na festa?' },
    contact: { whatsapp: '+5519998764521', email: null },
    plusOneSlots: 1,
    ...overrides,
  } as RsvpResponse;
}

type Call = { method: string; body: unknown };

function mockRsvp({
  data = rsvp(),
  put = (body: unknown) => {
    const sent = body as { guests: { id: string; status: string; name?: string | null }[] };
    return Response.json({
      ...data,
      party: { ...data.party, version: data.party.version + 1 },
      guests: data.guests.map((guest) => {
        const answer = sent.guests.find((item) => item.id === guest.id);
        return answer
          ? { ...guest, rsvpStatus: answer.status, name: answer.name ?? guest.name }
          : guest;
      }),
    });
  },
}: { data?: RsvpResponse; put?: (body: unknown) => Response } = {}) {
  const calls: Call[] = [];
  mockApi(({ method, path, body }) => {
    if (path !== '/v1/sites/ana-e-marcos/rsvp')
      return apiError({ status: 404, body: { error: 'X' } });
    if (method === 'GET') return Response.json(data);
    calls.push({ method, body });
    return put(body);
  });
  return calls;
}

function renderRsvp() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RsvpPage slug="ana-e-marcos" now={now} />
    </QueryClientProvider>,
  );
}

const choice = (name: string) => screen.getByRole('group', { name });
const send = () => screen.getByRole('button', { name: 'Enviar respostas' });

describe('Confirmar presença (Confirmar presença RN01 a RN14)', () => {
  it('o formulário: o prazo, um bloco por pessoa, a vaga e quem assina (RN03 a RN05)', async () => {
    mockRsvp();
    renderRsvp();
    expect(
      await screen.findByRole('heading', { name: 'Confirmar presença', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Família Nunes')).toBeInTheDocument();
    expect(screen.getByText('Vocês podem responder até 15 de out.')).toBeInTheDocument();
    expect(
      within(choice('Carla Nunes'))
        .getAllByRole('radio')
        .map((radio) => radio.closest('label')?.textContent),
    ).toEqual(['Vou', 'Não vou']);
    expect(choice('Rafael Nunes')).toBeInTheDocument();
    expect(
      screen.getByText('Vocês podem levar 1 acompanhante', { selector: 'p' }),
    ).toBeInTheDocument();
    expect(within(choice('Vocês podem levar 1 acompanhante')).getAllByRole('radio')).toHaveLength(
      2,
    );
    expect(choice('Quem está respondendo?')).toHaveAccessibleDescription(
      'O casal vê quem enviou as respostas.',
    );
    // Restrição e música só com Vou (RN03; Música RN04).
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('com Vou, a restrição e a música, com os textos e os limites (RN03; Música RN04)', async () => {
    const user = userEvent.setup();
    mockRsvp();
    renderRsvp();
    await user.click(
      within(await screen.findByRole('group', { name: 'Carla Nunes' })).getByLabelText('Vou'),
    );
    const diet = screen.getByRole('textbox', { name: 'Restrição alimentar (opcional)' });
    expect(diet).toHaveAttribute('placeholder', 'Ex.: dieta vegetariana, sem lactose');
    expect(diet).toHaveAccessibleDescription(
      'Conte só o que o buffet precisa saber. Ex.: vegetariano, sem glúten, alergia a amendoim.',
    );
    expect(diet).toHaveAttribute('maxlength', '200');
    const song = screen.getByRole('textbox', {
      name: 'Que música não pode faltar na festa? (opcional)',
    });
    expect(song).toHaveAttribute('placeholder', 'Ex.: Evidências, Chitãozinho & Xororó');
    expect(song).toHaveAttribute('maxlength', '120');
  });

  it('sem resposta e sem quem assina: os erros, sem enviar (RN04, RN06)', async () => {
    const user = userEvent.setup();
    const calls = mockRsvp();
    renderRsvp();
    await user.click(
      within(await screen.findByRole('group', { name: 'Carla Nunes' })).getByLabelText('Vou'),
    );
    await user.click(send());
    expect(
      screen.getByText('Falta a resposta de Rafael Nunes. Marquem Vou ou Não vou.'),
    ).toBeInTheDocument();
    expect(choice('Quem está respondendo?')).toHaveAccessibleDescription(
      'Escolham quem está respondendo. O casal vê quem enviou as respostas.',
    );
    expect(calls).toHaveLength(0);
  });

  it('Vou levar pede o nome; envia, confirma com o resumo e Alterar respostas reabre (RN05, RN07, RN09)', async () => {
    const user = userEvent.setup();
    const calls = mockRsvp();
    renderRsvp();
    await user.click(
      within(await screen.findByRole('group', { name: 'Carla Nunes' })).getByLabelText('Vou'),
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Restrição alimentar (opcional)' }),
      'sem glúten',
    );
    await user.click(within(choice('Rafael Nunes')).getByLabelText('Não vou'));
    await user.click(
      within(choice('Vocês podem levar 1 acompanhante')).getByLabelText('Vou levar'),
    );
    await user.click(within(choice('Quem está respondendo?')).getByLabelText('Carla'));
    await user.click(send());
    expect(
      screen.getByRole('textbox', { name: 'Nome do acompanhante' }),
    ).toHaveAccessibleDescription('Informem o nome do acompanhante.');
    expect(calls).toHaveLength(0);
    await user.type(screen.getByRole('textbox', { name: 'Nome do acompanhante' }), 'Rita Lopes');
    await user.click(send());
    expect(await screen.findByText('Vocês confirmaram 2 pessoas.')).toBeInTheDocument();
    expect(calls[0]?.body).toEqual({
      version: 3,
      signedByGuestId: 'g1',
      guests: [
        { id: 'g1', status: 'confirmed', dietaryRestriction: 'sem glúten', songSuggestion: null },
        { id: 'g2', status: 'declined', dietaryRestriction: null, songSuggestion: null },
        {
          id: 'v1',
          status: 'confirmed',
          dietaryRestriction: null,
          songSuggestion: null,
          name: 'Rita Lopes',
        },
      ],
    });
    const summary = screen.getByRole('list');
    expect(
      within(summary)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Carla NunesVou', 'Rafael NunesNão vou', 'Rita LopesVou']);
    expect(screen.queryByText(/Obrigado/)).toBeNull();
    // A nota com o prazo (decisão 232(3)).
    expect(screen.getByText('Dá para alterar até 15 de out.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Alterar respostas' }));
    expect(within(choice('Rafael Nunes')).getByLabelText('Não vou')).toBeChecked();
    // Quem assinou fica lembrado neste aparelho (RN04).
    expect(within(choice('Quem está respondendo?')).getByLabelText('Carla')).toBeChecked();
  });

  it('enviar sem mudar nada volta à confirmação, com a mesma version (RN09)', async () => {
    const user = userEvent.setup();
    const answered = rsvp({
      guests: rsvp().guests.map((guest) =>
        guest.isPlusOne ? guest : { ...guest, rsvpStatus: 'confirmed' as const },
      ),
    });
    // A API devolve o mesmo RSVP, com a mesma version, quando nada mudou.
    const calls = mockRsvp({ data: answered, put: () => Response.json(answered) });
    renderRsvp();
    await user.click(await screen.findByRole('button', { name: 'Alterar respostas' }));
    await user.click(within(choice('Quem está respondendo?')).getByLabelText('Carla'));
    await user.click(send());
    expect(await screen.findByText('Vocês confirmaram 2 pessoas.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar respostas' })).toBeNull();
    expect(calls).toHaveLength(1);
  });

  it('só recusas: "Recebemos sua resposta." (RN09)', async () => {
    mockRsvp({
      data: rsvp({
        guests: rsvp().guests.map((guest) =>
          guest.isPlusOne ? guest : { ...guest, rsvpStatus: 'declined' },
        ),
      }),
    });
    renderRsvp();
    expect(await screen.findByText('Recebemos sua resposta.')).toBeInTheDocument();
  });

  it('o 409 RSVP_CHANGED recarrega com as respostas atuais e diz o porquê (RN07)', async () => {
    const user = userEvent.setup();
    const current = rsvp({
      party: { id: 'p1', name: 'Família Nunes', version: 4 },
      guests: rsvp().guests.map((guest) =>
        guest.id === 'g2' ? { ...guest, rsvpStatus: 'confirmed' } : guest,
      ),
    });
    mockRsvp({ put: () => apiError({ status: 409, body: { error: 'RSVP_CHANGED', current } }) });
    renderRsvp();
    await user.click(
      within(await screen.findByRole('group', { name: 'Carla Nunes' })).getByLabelText('Não vou'),
    );
    await user.click(within(choice('Rafael Nunes')).getByLabelText('Não vou'));
    await user.click(within(choice('Quem está respondendo?')).getByLabelText('Carla'));
    await user.click(send());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'As respostas deste grupo mudaram enquanto vocês preenchiam. O formulário agora mostra as respostas atuais: confiram e enviem de novo.',
    );
    expect(within(choice('Rafael Nunes')).getByLabelText('Vou')).toBeChecked();
  });

  it('o 409 com o grupo já respondido abre o formulário, não a confirmação (RN07)', async () => {
    const user = userEvent.setup();
    const answered = rsvp().guests.map((guest) =>
      guest.isPlusOne ? guest : { ...guest, rsvpStatus: 'declined' as const },
    );
    const current = rsvp({
      party: { id: 'p1', name: 'Família Nunes', version: 4 },
      guests: answered,
    });
    mockRsvp({
      data: rsvp({ guests: answered }),
      put: () => apiError({ status: 409, body: { error: 'RSVP_CHANGED', current } }),
    });
    renderRsvp();
    await user.click(await screen.findByRole('button', { name: 'Alterar respostas' }));
    await user.click(within(choice('Quem está respondendo?')).getByLabelText('Carla'));
    await user.click(send());
    expect(await screen.findByRole('alert')).toHaveTextContent(/mudaram enquanto vocês preenchiam/);
    expect(send()).toBeInTheDocument();
  });

  it('rede ou 5xx: o aviso, com o que foi marcado na tela (RN14)', async () => {
    const user = userEvent.setup();
    mockRsvp({ put: () => apiError({ status: 500, body: {} }) });
    renderRsvp();
    await user.click(
      within(await screen.findByRole('group', { name: 'Carla Nunes' })).getByLabelText('Não vou'),
    );
    await user.click(within(choice('Rafael Nunes')).getByLabelText('Não vou'));
    await user.click(within(choice('Quem está respondendo?')).getByLabelText('Rafael'));
    await user.click(send());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível enviar as respostas. Confiram a conexão e tentem de novo. O que vocês marcaram continua na tela.',
    );
    expect(within(choice('Carla Nunes')).getByLabelText('Não vou')).toBeChecked();
  });

  it('o limite do dia e o link que deixou de valer (RN10, RN11)', async () => {
    const user = userEvent.setup();
    mockRsvp({ put: () => apiError({ status: 429, body: { error: 'RSVP_LIMIT' } }) });
    const view = renderRsvp();
    await user.click(
      within(await screen.findByRole('group', { name: 'Carla Nunes' })).getByLabelText('Não vou'),
    );
    await user.click(within(choice('Rafael Nunes')).getByLabelText('Não vou'));
    await user.click(within(choice('Quem está respondendo?')).getByLabelText('Rafael'));
    await user.click(send());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este grupo já mudou as respostas muitas vezes hoje. Tentem de novo amanhã ou falem com o casal.',
    );
    view.unmount();
    // O 429 por minuto (decisão 232(6)).
    mockRsvp({ put: () => apiError({ status: 429, body: { error: 'RSVP_RATE_LIMITED' } }) });
    const minute = renderRsvp();
    await user.click(
      within(await screen.findByRole('group', { name: 'Carla Nunes' })).getByLabelText('Não vou'),
    );
    await user.click(within(choice('Rafael Nunes')).getByLabelText('Não vou'));
    await user.click(within(choice('Quem está respondendo?')).getByLabelText('Rafael'));
    await user.click(send());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Muitas tentativas seguidas. Esperem um minuto e enviem de novo. O que vocês marcaram continua na tela.',
    );
    minute.unmount();
    mockRsvp({ put: () => apiError({ status: 401, body: { error: 'PARTY_SESSION_INVALID' } }) });
    renderRsvp();
    await user.click(
      within(await screen.findByRole('group', { name: 'Carla Nunes' })).getByLabelText('Não vou'),
    );
    await user.click(within(choice('Rafael Nunes')).getByLabelText('Não vou'));
    await user.click(within(choice('Quem está respondendo?')).getByLabelText('Rafael'));
    await user.click(send());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este link não funciona mais. Peça um novo link ao casal.',
    );
  });

  it('na prévia como grupo, o Enviar desabilitado com a ajuda, sem enviar (RN01)', async () => {
    const calls = mockRsvp({ data: rsvp({ state: 'preview' }) });
    renderRsvp();
    expect(await screen.findByRole('button', { name: 'Enviar respostas' })).toBeDisabled();
    expect(send()).toHaveAccessibleDescription('Na prévia, as respostas não são enviadas.');
    expect(calls).toHaveLength(0);
  });

  it('depois do prazo: só leitura, com o contato do casal; no pós-evento, o outro texto (RN08)', async () => {
    const answered = rsvp().guests.map((guest) =>
      guest.isPlusOne ? guest : { ...guest, rsvpStatus: 'confirmed' as const },
    );
    mockRsvp({ data: rsvp({ state: 'deadline_passed', guests: answered }) });
    const view = renderRsvp();
    expect(
      await screen.findByText('O prazo terminou. Se algo mudou, fale com o casal.'),
    ).toBeInTheDocument();
    expect(screen.getByText('WhatsApp do casal: (19) 99876-4521')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    view.unmount();
    mockRsvp({ data: rsvp({ state: 'post_event', guests: answered }) });
    renderRsvp();
    expect(
      await screen.findByText('O casamento já aconteceu. As respostas ficam guardadas aqui.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/WhatsApp do casal/)).toBeNull();
  });

  it('duas vagas: um cartão com "Acompanhante 1" e "Acompanhante 2" (RN05; 232(4))', async () => {
    const slot = {
      id: 'v2',
      name: null,
      rsvpStatus: 'pending' as const,
      dietaryRestriction: null,
      songSuggestion: null,
      isPlusOne: true,
    };
    mockRsvp({ data: rsvp({ guests: [...rsvp().guests, slot], plusOneSlots: 2 }) });
    renderRsvp();
    expect(
      await screen.findByText('Vocês podem levar 2 acompanhantes', { selector: 'p' }),
    ).toBeInTheDocument();
    expect(within(choice('Acompanhante 1')).getByLabelText('Vou levar')).toBeInTheDocument();
    expect(within(choice('Acompanhante 2')).getByLabelText('Não vou levar')).toBeInTheDocument();
  });

  it('sem prazo, a linha não aparece (RN03)', async () => {
    mockRsvp({ data: rsvp({ rsvpDeadline: null }) });
    renderRsvp();
    await screen.findByRole('heading', { name: 'Confirmar presença' });
    expect(screen.queryByText(/podem responder até/)).toBeNull();
    expect(screen.queryByText(/Dá para alterar/)).toBeNull();
  });

  it('é acessível', async () => {
    const user = userEvent.setup();
    mockRsvp();
    const { container } = renderRsvp();
    await user.click(
      within(await screen.findByRole('group', { name: 'Carla Nunes' })).getByLabelText('Vou'),
    );
    await user.click(send());
    await waitFor(() => expect(screen.getByText(/Falta a resposta/)).toBeInTheDocument());
    await expectNoA11yViolations({ container });
  });
});
