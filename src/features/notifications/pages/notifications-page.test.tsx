import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { meFor, profileUnderTest } from '../../../../tests/profile';
import {
  apiError,
  isLayoutRead,
  layoutReadNotFound,
  mockApi,
  renderAreaScreen,
  renderRoute,
} from '../../../../tests/render-route';
import { me } from '../../site/sections/section-test-fixtures';

afterEach(() => vi.unstubAllGlobals());

const today = (hour: number, minute: number) => {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

const entry = (partyId: string, name: string, confirmed = 3, declined = 1) => ({
  at: today(19, 40),
  partyId,
  name,
  confirmed,
  declined,
});

const notification = (id: string, overrides: object = {}) => ({
  id,
  type: 'rsvp',
  weddingId: 'w1',
  partnerNames: ['Ana', 'Marcos'],
  readAt: null,
  updatedAt: today(19, 40),
  count: 1,
  payload: [entry('p1', 'Família Moreira')],
  ...overrides,
});

type Call = { method: string; path: string };

function mockNotifications({
  pages = [
    [
      notification('n1', {
        count: 5,
        payload: [
          entry('p1', 'Família Moreira'),
          entry('p2', 'Família Duarte'),
          entry('p3', 'Carla e Rafael'),
          entry('p4', 'Tio Jorge'),
        ],
      }),
      notification('n2', {
        readAt: '2026-09-25T10:00:00Z',
        updatedAt: new Date(2026, 8, 24, 19, 40).toISOString(),
        payload: [entry('p3', 'Carla e Rafael', 1, 1)],
      }),
    ],
  ],
  readAll = 'ok',
  filtered = false,
}: { pages?: object[][]; readAll?: 'ok' | 'fail'; filtered?: boolean } = {}) {
  const calls: Call[] = [];
  mockApi(({ method, path }) => {
    if (path === '/v1/me') return Response.json(meFor(me));
    if (isLayoutRead({ method, path })) return layoutReadNotFound();
    calls.push({ method, path });
    if (path.startsWith('/v1/me/notifications/read-all') && method === 'POST') {
      return readAll === 'ok'
        ? new Response(null, { status: 204 })
        : apiError({ status: 500, body: { error: 'INTERNAL' } });
    }
    if (/^\/v1\/me\/notifications\/[^/?]+\/read$/.test(path) && method === 'POST') {
      return new Response(null, { status: 204 });
    }
    if (path.startsWith('/v1/me/notifications') && method === 'GET' && filtered) {
      // O filtro pedido não tem nenhuma (o "Nenhuma notificação deste tipo.").
      if (path.includes('type=')) return Response.json({ items: [], nextCursor: null });
    }
    if (path.startsWith('/v1/me/notifications') && method === 'GET') {
      const cursor = new URLSearchParams(path.split('?')[1]).get('cursor');
      const index = cursor ? Number(cursor) : 0;
      return Response.json({
        items: pages[index] ?? [],
        nextCursor: index + 1 < pages.length ? String(index + 1) : null,
      });
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

describe('Notificações (Central RN04 a RN06)', () => {
  it('a agrupada com os nomes e a data à parte; a de 1 grupo com os números e a data', async () => {
    mockNotifications();
    renderRoute({ url: '/app/notificacoes' });
    expect(
      await screen.findByRole('heading', { name: 'Notificações', level: 1 }),
    ).toBeInTheDocument();
    const [grouped, single] = await screen.findAllByRole('listitem');
    expect(grouped).toHaveTextContent('5 grupos responderam');
    expect(grouped).toHaveTextContent(
      'Família Moreira · Família Duarte · Carla e Rafael · + 2 grupos',
    );
    expect(grouped).toHaveTextContent('hoje às 19h40');
    expect(within(grouped as HTMLElement).getByRole('button')).toHaveAccessibleName(
      /^5 grupos responderam, não lida/,
    );
    expect(single).toHaveTextContent('Carla e Rafael respondeu o convite');
    expect(single).toHaveTextContent('1 confirmado, 1 recusado · 24/09 às 19h40');
    expect(within(single as HTMLElement).getByRole('button')).not.toHaveAccessibleName(/não lida/);
  });

  it('abrir a de 1 grupo leva ao Painel e marca como lida; a agrupada leva à lista (RN05)', async () => {
    const user = userEvent.setup();
    const calls = mockNotifications({
      pages: [
        [
          notification('n3'),
          notification('n4', { count: 2, payload: [entry('p1', 'A'), entry('p2', 'B')] }),
        ],
      ],
    });
    const { router } = renderRoute({ url: '/app/notificacoes' });
    await user.click(
      await screen.findByRole('button', { name: /Família Moreira respondeu o convite/ }),
    );
    // O Painel do grupo abre (e, sem o grupo no mock, volta à lista).
    await waitFor(() =>
      expect(calls).toContainEqual({ method: 'GET', path: '/v1/weddings/w1/parties/p1' }),
    );
    await waitFor(() =>
      expect(calls).toContainEqual({ method: 'POST', path: '/v1/me/notifications/n3/read' }),
    );
    await router.navigate('/app/notificacoes');
    await user.click(await screen.findByRole('button', { name: /2 grupos responderam/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/convidados'));
  });

  it('o aviso de cobrança (billing) não aparece: o front da F3 o desenha (Central RN01)', async () => {
    mockNotifications({
      pages: [
        [
          notification('nb', { type: 'billing', payload: [{ kind: 'payment_confirmed' }] }),
          notification('n1'),
        ],
      ],
    });
    renderRoute({ url: '/app/notificacoes' });
    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('Família Moreira respondeu o convite');
    expect(screen.queryByText(/^ respondeu o convite/)).toBeNull();
  });

  it('só avisos de cobrança: o vazio', async () => {
    mockNotifications({
      pages: [[notification('nb', { type: 'billing', payload: [{ kind: 'payment_confirmed' }] })]],
    });
    renderRoute({ url: '/app/notificacoes' });
    expect(await screen.findByText('Ainda não há notificações')).toBeInTheDocument();
  });

  it('Marcar todas como lidas: o Toast e a lista lida de novo (RN06)', async () => {
    const user = userEvent.setup();
    const calls = mockNotifications();
    renderRoute({ url: '/app/notificacoes' });
    await user.click(await screen.findByRole('button', { name: 'Marcar todas como lidas' }));
    expect(
      await screen.findByText('Todas as notificações foram marcadas como lidas.'),
    ).toBeInTheDocument();
    expect(calls).toContainEqual({
      method: 'POST',
      path: '/v1/me/notifications/read-all?weddingId=w1',
    });
  });

  it('Marcar todas falhando: o Toast de erro', async () => {
    const user = userEvent.setup();
    mockNotifications({ readAll: 'fail' });
    renderRoute({ url: '/app/notificacoes' });
    await user.click(await screen.findByRole('button', { name: 'Marcar todas como lidas' }));
    expect(await screen.findByText(/^Não foi possível continuar/)).toBeInTheDocument();
  });

  it('o filtro Respostas e o Carregar mais pelo cursor', async () => {
    const user = userEvent.setup();
    const calls = mockNotifications({
      pages: [[notification('n1')], [notification('n9', { payload: [entry('p9', 'Vó Helena')] })]],
    });
    renderRoute({ url: '/app/notificacoes' });
    await user.click(await screen.findByRole('button', { name: 'Carregar mais' }));
    expect(await screen.findByText('Vó Helena respondeu o convite')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).toBeNull();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tipo' }), 'Respostas');
    await waitFor(() =>
      expect(calls.map((call) => call.path)).toContain(
        '/v1/me/notifications?weddingId=w1&type=rsvp',
      ),
    );
  });

  it('o filtro sem resultado: "Nenhuma notificação deste tipo." (RN06)', async () => {
    const user = userEvent.setup();
    mockNotifications({ filtered: true });
    renderRoute({ url: '/app/notificacoes' });
    await screen.findAllByRole('listitem');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tipo' }), 'Respostas');
    expect(await screen.findByText('Nenhuma notificação deste tipo.')).toBeInTheDocument();
    expect(screen.queryByText('Ainda não há notificações')).toBeNull();
  });

  it('vazia: o Empty State; sem não lidas, o Marcar todas desabilitado', async () => {
    mockNotifications({ pages: [[]] });
    renderRoute({ url: '/app/notificacoes' });
    expect(await screen.findByText('Ainda não há notificações')).toBeInTheDocument();
    expect(
      screen.getByText('Elas aparecem aqui quando um grupo responder o convite.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marcar todas como lidas' })).toBeDisabled();
  });

  it('a colaboradora: os avisos vão só para o casal (RN03, RN06)', async () => {
    profileUnderTest.current = 'planner';
    mockNotifications();
    renderAreaScreen({ url: '/app/notificacoes' });
    expect(
      await screen.findByText('Por enquanto, os avisos deste casamento vão só para o casal.'),
    ).toBeInTheDocument();
  });

  it('é acessível', async () => {
    mockNotifications();
    const { container } = renderRoute({ url: '/app/notificacoes' });
    await screen.findAllByRole('listitem');
    await expectNoA11yViolations({ container });
  });
});
