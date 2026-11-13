import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { meFor } from '../../../../tests/profile';
import {
  apiError,
  isLayoutRead,
  layoutReadNotFound,
  mockApi,
  renderRoute,
} from '../../../../tests/render-route';
import { me } from '../../site/sections/section-test-fixtures';

afterEach(() => vi.unstubAllGlobals());

type Call = { method: string; path: string; body: unknown };

function mockPreferences({ save = 'ok' }: { save?: 'ok' | 'fail' } = {}) {
  const calls: Call[] = [];
  mockApi(({ method, path, body }) => {
    if (path === '/v1/me') return Response.json(meFor(me));
    if (isLayoutRead({ method, path })) return layoutReadNotFound();
    if (path.startsWith('/v1/me/notification-preferences') && method === 'GET') {
      return Response.json({
        items: [{ type: 'rsvp', email: 'daily', inApp: true, push: false }],
        push: {},
      });
    }
    if (path.startsWith('/v1/me/notification-preferences') && method === 'PUT') {
      calls.push({ method, path, body });
      return save === 'ok'
        ? Response.json({ ...(body as object), inApp: true, push: false })
        : apiError({ status: 500, body: { error: 'INTERNAL' } });
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

describe('Configurações › Notificações (Central RN07; decisão 221)', () => {
  it('o título com a pessoa, a aba, a linha Respostas do convite e a nota da central', async () => {
    mockPreferences();
    renderRoute({ url: '/app/configuracoes/notificacoes' });
    expect(
      await screen.findByRole('heading', { name: 'Configurações', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Ana Beatriz Moreira · ana.moreira@gmail.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Notificações' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(await screen.findByText('Respostas do convite')).toBeInTheDocument();
    expect(screen.getByText('Escolha como você quer receber cada aviso.')).toBeInTheDocument();
    const email = screen.getByRole('combobox', { name: /^E.?-.?mail$/u });
    expect(email).toHaveDisplayValue('Resumo diário às 20h');
    expect(
      Array.from((email as HTMLSelectElement).options).map((option) => option.textContent),
    ).toEqual(['Na hora', 'Resumo diário às 20h', 'Desligado']);
    expect(
      screen.getByText(
        'A central do app sempre recebe tudo. O push mostra só o nome do grupo, sem valores nem o texto do recado.',
      ),
    ).toBeInTheDocument();
  });

  it('mudar o e-mail grava na hora, com o Toast "Preferências salvas."', async () => {
    const user = userEvent.setup();
    const calls = mockPreferences();
    renderRoute({ url: '/app/configuracoes/notificacoes' });
    await user.selectOptions(
      await screen.findByRole('combobox', { name: /^E.?-.?mail$/u }),
      'Na hora',
    );
    expect(await screen.findByText('Preferências salvas.')).toBeInTheDocument();
    expect(calls[0]?.body).toEqual({ weddingId: 'w1', type: 'rsvp', email: 'immediate' });
  });

  it('a falha ao gravar: o Toast de erro e o valor de antes', async () => {
    const user = userEvent.setup();
    mockPreferences({ save: 'fail' });
    renderRoute({ url: '/app/configuracoes/notificacoes' });
    const email = await screen.findByRole('combobox', { name: /^E.?-.?mail$/u });
    await user.selectOptions(email, 'Desligado');
    expect(await screen.findByText(/^Não foi possível continuar/)).toBeInTheDocument();
    await waitFor(() => expect(email).toHaveDisplayValue('Resumo diário às 20h'));
  });

  it('é acessível', async () => {
    mockPreferences();
    const { container } = renderRoute({ url: '/app/configuracoes/notificacoes' });
    await screen.findByText('Respostas do convite');
    await expectNoA11yViolations({ container });
  });
});
