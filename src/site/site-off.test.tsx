import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../tests/a11y';
import { apiError, mockApi } from '../../tests/render-route';
import { SiteApp } from './site-app';

/*
 * O site fora do ar para o convidado (Data de saída RN08, B1; Bloqueado RN05, Penpot 03): o
 * 410 SITE_EXPIRED e o 423 SITE_UNAVAILABLE, no site, no link do grupo e na prévia, com uma
 * frase só, sem dado do casal e sem botão.
 */

const EXPIRED = 'Este site não está mais disponível.';
const UNAVAILABLE = 'Este site não está disponível no momento.';
const OFF = {
  expired: { status: 410, body: { statusCode: 410, error: 'SITE_EXPIRED' } },
  unavailable: { status: 423, body: { statusCode: 423, error: 'SITE_UNAVAILABLE' } },
};

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

async function expectOffPage(title: string) {
  expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Feito com Kore' })).toBeInTheDocument();
  // Sem dado do casal e sem botão.
  expect(screen.queryByText(/Ana|Marcos/)).toBeNull();
  expect(screen.queryByRole('button')).toBeNull();
}

describe('o site fora do ar (Data de saída RN08; Bloqueado RN05)', () => {
  it.each([
    ['expirado ou exclusão agendada (410)', OFF.expired, EXPIRED],
    ['bloqueado (423)', OFF.unavailable, UNAVAILABLE],
  ])('o endereço do site: %s', async (_name, off, title) => {
    mockApi(() => apiError(off));
    const { container } = render(<SiteApp pathname="/ana-e-marcos" />);
    await expectOffPage(title);
    await expectNoA11yViolations({ container });
  });

  it.each([
    ['410', OFF.expired, EXPIRED],
    ['423', OFF.unavailable, UNAVAILABLE],
  ])('o link do grupo (%s): a mesma página, sem o token no endereço', async (_name, off, title) => {
    window.history.replaceState(null, '', '/ana-e-marcos/grupo/q3Xv8LmN2pRtY7wK1cZb4A');
    mockApi(() => apiError(off));
    render(<SiteApp pathname="/ana-e-marcos/grupo/q3Xv8LmN2pRtY7wK1cZb4A" />);
    await expectOffPage(title);
    expect(window.location.pathname).toBe('/ana-e-marcos');
  });

  it('o Confirmar presença (423): a mesma página', async () => {
    mockApi(() => apiError(OFF.unavailable));
    render(<SiteApp pathname="/ana-e-marcos/confirmar-presenca" />);
    await expectOffPage(UNAVAILABLE);
  });

  it('a prévia (410): a mesma página, no lugar de "Esta prévia não vale mais."', async () => {
    mockApi(() => apiError(OFF.expired));
    render(<SiteApp pathname="/ana-e-marcos" search="?previa=q3Xv8LmN2pRtY7wK1cZb4A" />);
    await expectOffPage(EXPIRED);
    expect(screen.queryByText('Esta prévia não vale mais.')).toBeNull();
  });
});
