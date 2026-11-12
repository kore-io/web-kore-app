import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { profileUnderTest } from '../../../../tests/profile';
import { renderAreaScreen, renderRoute } from '../../../../tests/render-route';
import { mockSite, siteWith } from '../sections/section-test-fixtures';

vi.mock('../site-fonts', () => ({ loadEditorFonts: vi.fn(async () => undefined) }));

function fakeTab() {
  return { opener: {}, closed: false, location: { href: '' }, close: vi.fn() };
}

describe('Site › Pré-visualizar no Editor (Pré-visualização RN01)', () => {
  it('abre a aba no clique e a aponta para a prévia como visitante', async () => {
    const user = userEvent.setup();
    const tab = fakeTab();
    const open = vi.fn(() => tab);
    vi.stubGlobal('open', open);
    const calls = mockSite();
    renderRoute({ url: '/app/site/hospedagem-e-transporte' });
    await user.click(await screen.findByRole('button', { name: 'Pré-visualizar' }));
    expect(open).toHaveBeenCalledWith('', '_blank');
    await waitFor(() =>
      expect(tab.location.href).toBe('http://localhost:5174/ana-e-marcos?previa=tok'),
    );
    expect(tab.opener).toBeNull();
    expect(calls).toEqual([
      { method: 'POST', path: '/v1/weddings/w1/site-previews', body: { mode: 'visitor' } },
    ]);
  });

  it('com mudança não salva, o Dialog de descartar; Continuar editando não abre, e Descartar volta ao salvo e abre', async () => {
    const user = userEvent.setup();
    const tab = fakeTab();
    const open = vi.fn(() => tab);
    vi.stubGlobal('open', open);
    mockSite();
    renderRoute({ url: '/app/site/hospedagem-e-transporte' });
    await user.type(await screen.findByRole('textbox', { name: 'Texto' }), 'Hotel Vitória.');
    await user.click(screen.getByRole('button', { name: 'Pré-visualizar' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Descartar as alterações?' });
    expect(dialog).toHaveTextContent('O que mudou em Hospedagem e transporte ainda não foi salvo.');
    await user.click(screen.getByRole('button', { name: 'Continuar editando' }));
    expect(open).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Texto' })).toHaveValue('Hotel Vitória.');
    await user.click(screen.getByRole('button', { name: 'Pré-visualizar' }));
    await user.click(screen.getByRole('button', { name: 'Descartar alterações' }));
    expect(open).toHaveBeenCalledWith('', '_blank');
    expect(screen.getByRole('textbox', { name: 'Texto' })).toHaveValue('');
    await waitFor(() => expect(tab.location.href).toContain('?previa=tok'));
  });

  it('sem endereço: desabilitado, com a ajuda de cada perfil', async () => {
    const noSlug = { ...siteWith(), slug: null } as unknown as ReturnType<typeof siteWith>;
    mockSite({ site: noSlug });
    const { unmount } = renderRoute({ url: '/app/site/hospedagem-e-transporte' });
    const button = await screen.findByRole('button', { name: 'Pré-visualizar' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(
      'Escolham o endereço do site em Dados básicos para ver a prévia.',
    );
    unmount();
    profileUnderTest.current = 'planner';
    mockSite({ site: noSlug });
    renderAreaScreen({ url: '/app/site/hospedagem-e-transporte' });
    expect(
      await screen.findByRole('button', { name: 'Pré-visualizar' }),
    ).toHaveAccessibleDescription('Escolha o endereço do site em Dados básicos para ver a prévia.');
  });

  it('se o token falha, a aba vazia fecha e vem o aviso de erro', async () => {
    const user = userEvent.setup();
    const tab = fakeTab();
    vi.stubGlobal(
      'open',
      vi.fn(() => tab),
    );
    mockSite({ preview: () => Response.json({ error: 'X' }, { status: 500 }) });
    renderRoute({ url: '/app/site/hospedagem-e-transporte' });
    await user.click(await screen.findByRole('button', { name: 'Pré-visualizar' }));
    await waitFor(() => expect(tab.close).toHaveBeenCalled());
    expect(await screen.findByText(/Algo deu errado|Não foi possível/)).toBeInTheDocument();
  });
});
