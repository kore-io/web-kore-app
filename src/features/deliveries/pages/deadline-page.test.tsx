import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { meFor, profileUnderTest } from '../../../../tests/profile';
import { apiError, mockApi, renderAreaScreen, renderRoute } from '../../../../tests/render-route';
import { oneDot, shortDayMonth } from '../../../shared/date-texts';
import { todayIn } from '../../site/site-texts';

const me = {
  user: { id: 'u1', name: 'Ana Beatriz Moreira', email: 'ana@exemplo.com', platformRole: 'none' },
  activeProfile: 'couple',
  authenticatedAt: '2026-11-05T12:00:00Z',
  memberships: [
    {
      weddingId: 'w1',
      role: 'owner',
      weddingName: 'Ana & Marcos',
      eventDate: '2027-11-14',
      city: 'Campinas',
      state: 'SP',
    },
  ],
  profiles: ['couple'],
  lastProfileOnDevice: 'couple',
  planner: null,
  referrer: null,
};

/** Um dia a partir de hoje no fuso do casamento, como AAAA-MM-DD. */
function dayFromToday(offset: number): string {
  const today = new Date(
    `${todayIn({ timezone: 'America/Sao_Paulo', now: new Date() })}T12:00:00Z`,
  );
  today.setUTCDate(today.getUTCDate() + offset);
  return today.toISOString().slice(0, 10);
}

type Call = { method: string; path: string; body: unknown };

function mockDeadline({
  deadline = dayFromToday(19),
  queue = { parties: 15, guests: 28, notReminded: 3 },
  put = () => Response.json({ rsvpDeadline: null }),
}: {
  deadline?: string | null;
  queue?: { parties: number; guests: number; notReminded: number };
  put?: (body: unknown) => Response;
} = {}) {
  const calls: Call[] = [];
  let current = deadline;
  mockApi(({ method, path, body }) => {
    if (path === '/v1/me') return Response.json(meFor(me));
    if (path === '/v1/weddings/w1/dashboard') {
      return Response.json({
        role: 'owner',
        rsvpDeadline: current,
        eventDate: '2027-11-14',
        reminderQueue: queue,
      });
    }
    if (path === '/v1/weddings/w1/site') return Response.json({ timezone: 'America/Sao_Paulo' });
    if (method === 'PUT' && path === '/v1/weddings/w1/rsvp-deadline') {
      calls.push({ method, path, body });
      const response = put(body);
      if (response.ok) current = (body as { rsvpDeadline: string | null }).rsvpDeadline;
      return response;
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

const field = () => screen.getByLabelText('Prazo de resposta');
/** O link do Lembrar pendentes do Stat Card (a aba do lembrete tem o mesmo nome e destino). */
const remindLink = () =>
  screen
    .getAllByRole('link', { name: 'Lembrar pendentes' })
    .find((link) => link.closest('.kore-deadline'));
/** A linha de apoio do Stat Card dos pendentes, com o link. */
const pendingDetail = () => remindLink()?.parentElement?.textContent;
const short = (day: string) => shortDayMonth({ day, now: new Date() });

describe('Envios › Prazo de resposta (Prazo e respostas RN01 a RN03; Penpot A7)', () => {
  it('com prazo: a data, os dias que faltam com o que o grupo vê, o aviso, os pendentes e os botões', async () => {
    const deadline = dayFromToday(19);
    mockDeadline({ deadline });
    renderRoute({ url: '/app/envios/prazo' });
    expect(await screen.findByRole('heading', { name: 'Envios', level: 1 })).toBeInTheDocument();
    expect(await screen.findByLabelText('Prazo de resposta')).toHaveValue(deadline);
    expect(field()).toHaveAccessibleDescription(
      oneDot(`Faltam 19 dias. No site, o grupo vê "Vocês podem responder até ${short(deadline)}."`),
    );
    expect(
      screen.getByText('Depois do prazo, só vocês podem alterar as respostas.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Os convidados veem a resposta dada, sem poder mudar.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Ainda sem resposta')).toBeInTheDocument();
    expect(screen.getByText('28')).toBeInTheDocument();
    expect(pendingDetail()).toBe('convidados em 15 grupos · Lembrar pendentes');
    // O Lembrar pendentes leva à aba do lembrete (o C4 mesclou).
    expect(remindLink()).toHaveAttribute('href', '/app/envios/lembrete');
    expect(screen.getByRole('button', { name: 'Tirar o prazo' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Salvar prazo' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Envios' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Prazo de resposta|Prazo/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('falta 1 dia, o dia do prazo e o singular dos pendentes', async () => {
    const tomorrow = dayFromToday(1);
    mockDeadline({ deadline: tomorrow, queue: { parties: 1, guests: 1, notReminded: 0 } });
    const view = renderRoute({ url: '/app/envios/prazo' });
    expect(await screen.findByLabelText('Prazo de resposta')).toHaveAccessibleDescription(
      oneDot(`Falta 1 dia. No site, o grupo vê "Vocês podem responder até ${short(tomorrow)}."`),
    );
    await waitFor(() => expect(pendingDetail()).toBe('convidado em 1 grupo · Lembrar pendentes'));
    view.unmount();
    // Zero fica no plural: "0 convidados em 0 grupos".
    mockDeadline({ deadline: tomorrow, queue: { parties: 0, guests: 0, notReminded: 0 } });
    const zero = renderRoute({ url: '/app/envios/prazo' });
    await waitFor(() => expect(pendingDetail()).toBe('convidados em 0 grupos · Lembrar pendentes'));
    zero.unmount();
    const today = dayFromToday(0);
    mockDeadline({ deadline: today });
    renderRoute({ url: '/app/envios/prazo' });
    expect(await screen.findByLabelText('Prazo de resposta')).toHaveAccessibleDescription(
      oneDot(
        `O prazo termina hoje, às 23h59. No site, o grupo vê "Vocês podem responder até ${short(today)}."`,
      ),
    );
  });

  it('prazo vencido: o Alert de Atenção no topo e a ajuda para reabrir (RN03)', async () => {
    const yesterday = dayFromToday(-1);
    mockDeadline({ deadline: yesterday });
    renderRoute({ url: '/app/envios/prazo' });
    expect(
      await screen.findByText(oneDot(`O prazo terminou em ${short(yesterday)}.`)),
    ).toBeInTheDocument();
    expect(screen.getByText('Os convidados só veem a resposta dada.')).toBeInTheDocument();
    expect(field()).toHaveAccessibleDescription(
      'Escolham uma nova data para reabrir as respostas.',
    );
    expect(screen.queryByText(/Depois do prazo, só vocês/)).toBeNull();
  });

  it('sem prazo: a ajuda, sem o Tirar o prazo; salvar grava e mostra "Prazo salvo." (RN02)', async () => {
    const user = userEvent.setup();
    const calls = mockDeadline({ deadline: null });
    renderRoute({ url: '/app/envios/prazo' });
    expect(await screen.findByLabelText('Prazo de resposta')).toHaveAccessibleDescription(
      'Sem prazo, os convidados respondem até o dia do casamento.',
    );
    expect(screen.queryByRole('button', { name: 'Tirar o prazo' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Salvar prazo' })).toBeDisabled();
    const day = dayFromToday(30);
    await user.type(field(), day);
    await user.click(screen.getByRole('button', { name: 'Salvar prazo' }));
    expect(await screen.findByText('Prazo salvo.')).toBeInTheDocument();
    expect(calls).toEqual([
      { method: 'PUT', path: '/v1/weddings/w1/rsvp-deadline', body: { rsvpDeadline: day } },
    ]);
  });

  it('Tirar o prazo grava nulo e mostra "Prazo retirado."', async () => {
    const user = userEvent.setup();
    const calls = mockDeadline();
    renderRoute({ url: '/app/envios/prazo' });
    await user.click(await screen.findByRole('button', { name: 'Tirar o prazo' }));
    expect(await screen.findByText('Prazo retirado.')).toBeInTheDocument();
    expect(calls[0]?.body).toEqual({ rsvpDeadline: null });
  });

  it('os 422 no campo: data no passado e depois do casamento (RN01)', async () => {
    const user = userEvent.setup();
    let code = 'DEADLINE_IN_PAST';
    mockDeadline({
      deadline: null,
      put: () => apiError({ status: 422, body: { error: code } }),
    });
    renderRoute({ url: '/app/envios/prazo' });
    await user.type(await screen.findByLabelText('Prazo de resposta'), dayFromToday(3));
    await user.click(screen.getByRole('button', { name: 'Salvar prazo' }));
    await waitFor(() =>
      expect(field()).toHaveAccessibleDescription(
        'Essa data já passou. Escolham uma data a partir de hoje.',
      ),
    );
    expect(field()).toHaveAttribute('aria-invalid', 'true');
    code = 'DEADLINE_AFTER_EVENT';
    await user.clear(field());
    await user.type(field(), dayFromToday(4));
    await user.click(screen.getByRole('button', { name: 'Salvar prazo' }));
    await waitFor(() =>
      expect(field()).toHaveAccessibleDescription(
        oneDot(
          `O prazo precisa ser até o dia do casamento, ${short('2027-11-14')}. Escolham outra data.`,
        ),
      ),
    );
  });

  it('a cerimonialista lê o aviso pelo casal e os erros no singular (198(2))', async () => {
    profileUnderTest.current = 'planner';
    const user = userEvent.setup();
    mockDeadline({ put: () => apiError({ status: 422, body: { error: 'DEADLINE_IN_PAST' } }) });
    renderAreaScreen({ url: '/app/envios/prazo' });
    expect(
      await screen.findByText('Depois do prazo, só o casal pode alterar as respostas.'),
    ).toBeInTheDocument();
    await user.clear(field());
    await user.type(field(), dayFromToday(5));
    await user.click(screen.getByRole('button', { name: 'Salvar prazo' }));
    await waitFor(() =>
      expect(field()).toHaveAccessibleDescription(
        'Essa data já passou. Escolha uma data a partir de hoje.',
      ),
    );
  });

  it('se o site não carrega, o aviso com o Tentar de novo, e não o Spinner', async () => {
    mockApi(({ path }) => {
      if (path === '/v1/me') return Response.json(meFor(me));
      if (path === '/v1/weddings/w1/dashboard') {
        return Response.json({
          rsvpDeadline: null,
          eventDate: '2027-11-14',
          reminderQueue: { parties: 0, guests: 0, notReminded: 0 },
        });
      }
      return apiError({ status: 500, body: {} });
    });
    renderRoute({ url: '/app/envios/prazo' });
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });

  it('é acessível', async () => {
    mockDeadline();
    const { container } = renderRoute({ url: '/app/envios/prazo' });
    await screen.findByLabelText('Prazo de resposta');
    await expectNoA11yViolations({ container });
  });
});
