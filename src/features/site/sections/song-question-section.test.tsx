import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { apiError, mockApi, renderRoute } from '../../../../tests/render-route';
import { me, siteWith } from './section-test-fixtures';

afterEach(() => vi.unstubAllGlobals());

const DEFAULT_TEXT = 'Que música não pode faltar na festa?';

type Call = { method: string; path: string; body: unknown };

function mockSongQuestion({
  enabled = false,
  text = DEFAULT_TEXT,
  fail = false,
}: { enabled?: boolean; text?: string; fail?: boolean } = {}) {
  const calls: Call[] = [];
  let current = { enabled, text };
  mockApi(({ method, path, body }) => {
    if (path === '/v1/me') return Response.json(me);
    if (path === '/v1/weddings/w1/site') {
      return Response.json({ ...siteWith(), songQuestion: current });
    }
    if (path === '/v1/weddings/w1/site/song-question' && method === 'PUT') {
      calls.push({ method, path, body });
      if (fail) return apiError({ status: 500, body: { error: 'INTERNAL' } });
      const data = body as { enabled: boolean; text: string | null };
      current = { enabled: data.enabled, text: data.text ?? DEFAULT_TEXT };
      return Response.json(current);
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

const URL_SONG = '/app/site/pergunta-de-musica';

describe('Site › Editor › Pergunta de música (Música RN01 a RN03)', () => {
  it('desligada: o Switch, o aviso e o campo desabilitado com o texto padrão', async () => {
    mockSongQuestion();
    renderRoute({ url: URL_SONG });
    expect(
      await screen.findByRole('heading', { name: 'Pergunta de música', level: 2 }),
    ).toBeInTheDocument();
    const toggle = screen.getByRole('switch', { name: 'Fazer a pergunta no RSVP' });
    expect(toggle).not.toBeChecked();
    expect(toggle).toHaveAccessibleDescription(
      'A pergunta não aparece no RSVP. As sugestões que já chegaram continuam guardadas.',
    );
    const field = screen.getByRole('textbox', { name: 'Texto da pergunta' });
    expect(field).toBeDisabled();
    expect(field).toHaveValue(DEFAULT_TEXT);
    expect(field).toHaveAccessibleDescription('Aparece no RSVP, depois da resposta de presença.');
    expect(field).toHaveAttribute('maxlength', '120');
    const list = screen.getByRole('navigation', { name: 'Seções' });
    expect(within(list).getByRole('link', { name: /Pergunta de música/ })).toHaveTextContent(
      'desligada',
    );
  });

  it('ligar e trocar o texto: o Salvar do cabeçalho grava a seção e mostra o Toast', async () => {
    const user = userEvent.setup();
    const calls = mockSongQuestion();
    renderRoute({ url: URL_SONG });
    const save = await screen.findByRole('button', { name: 'Salvar' });
    expect(save).toBeDisabled();
    await user.click(screen.getByRole('switch', { name: 'Fazer a pergunta no RSVP' }));
    expect(
      screen.queryByText(
        'A pergunta não aparece no RSVP. As sugestões que já chegaram continuam guardadas.',
      ),
    ).toBeNull();
    const field = screen.getByRole('textbox', { name: 'Texto da pergunta' });
    expect(field).toBeEnabled();
    await user.clear(field);
    await user.type(field, '  Qual música faz você dançar?  ');
    await user.click(save);
    expect(await screen.findByText('Alterações salvas.')).toBeInTheDocument();
    expect(calls[0]?.body).toEqual({ enabled: true, text: 'Qual música faz você dançar?' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled());
    expect(field).toHaveValue('Qual música faz você dançar?');
  });

  it('o texto vazio volta ao padrão (RN01)', async () => {
    const user = userEvent.setup();
    const calls = mockSongQuestion({ enabled: true, text: 'Qual música faz você dançar?' });
    renderRoute({ url: URL_SONG });
    const field = await screen.findByRole('textbox', { name: 'Texto da pergunta' });
    await user.clear(field);
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await screen.findByText('Alterações salvas.');
    expect(calls[0]?.body).toEqual({ enabled: true, text: null });
    expect(field).toHaveValue(DEFAULT_TEXT);
  });

  it('desligar só esconde: grava sem pedir confirmação (RN02)', async () => {
    const user = userEvent.setup();
    const calls = mockSongQuestion({ enabled: true });
    renderRoute({ url: URL_SONG });
    await user.click(await screen.findByRole('switch', { name: 'Fazer a pergunta no RSVP' }));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await screen.findByText('Alterações salvas.');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(calls[0]?.body).toEqual({ enabled: false, text: DEFAULT_TEXT });
  });

  it('a falha ao salvar mostra o Toast de erro e mantém a edição', async () => {
    const user = userEvent.setup();
    mockSongQuestion({ fail: true });
    renderRoute({ url: URL_SONG });
    await user.click(await screen.findByRole('switch', { name: 'Fazer a pergunta no RSVP' }));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText(/^Não foi possível continuar/)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Fazer a pergunta no RSVP' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled();
  });

  it('é acessível', async () => {
    mockSongQuestion();
    const { container } = renderRoute({ url: URL_SONG });
    await screen.findByRole('switch', { name: 'Fazer a pergunta no RSVP' });
    await expectNoA11yViolations({ container });
  });
});
