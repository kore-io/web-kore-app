import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { meFor } from '../../../../tests/profile';
import { apiError, mockApi, renderRoute } from '../../../../tests/render-route';

/*
 * Convidados no casamento bloqueado (Bloqueado RN02 a RN04): os botões de escrita
 * desabilitados com o motivo, a leitura liberada e o 403 em corrida no Toast.
 */

const LOCKED = 'Indisponível enquanto o site está bloqueado.';

function me(blocked: boolean) {
  return {
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
        timezone: 'America/Sao_Paulo',
        lifecycle: {
          status: 'published',
          endDate: '2028-02-14',
          graceUntil: null,
          expiredAt: null,
          paidThrough: '2028-02-14',
          deletionScheduledFor: null,
          blocked,
        },
      },
    ],
    profiles: ['couple'],
    lastProfileOnDevice: 'couple',
    planner: null,
    referrer: null,
  };
}

const summary = { guests: 3, namedGuests: 3, parties: 1, confirmed: 0, declined: 0, pending: 3 };
const PARTY = {
  id: 'p1',
  name: 'Família Moreira',
  contact: { guestId: 'g1', name: 'Célia Moreira', phoneMasked: '(19) 9****-3310' },
  firstGuestName: 'Célia Moreira',
  people: 3,
  counts: { confirmed: 0, declined: 0, pending: 3, pendingPlusOnes: 0 },
  deliveryStatus: 'not_sent',
  respondedAt: null,
  respondedBy: null,
  tags: [],
  link: { url: 'https://kore.com.br/ana-e-marcos/grupo/p1' },
};

function mockGuests({
  blocked = true,
  createTag,
}: {
  blocked?: boolean;
  createTag?: () => Response;
} = {}) {
  mockApi(({ method, path }) => {
    if (path === '/v1/me') return Response.json(meFor(me(blocked)));
    if (method === 'GET' && path.startsWith('/v1/weddings/w1/parties')) {
      return Response.json({ summary, total: 1, data: [PARTY], nextCursor: null });
    }
    if (method === 'GET' && path === '/v1/weddings/w1/tags') {
      return Response.json({
        limit: 10,
        data: [{ id: 't1', name: 'Padrinhos', color: 'wine', guests: 4 }],
      });
    }
    if (method === 'POST' && path === '/v1/weddings/w1/tags' && createTag) return createTag();
    if (method === 'GET' && path === '/v1/weddings/w1/trash') {
      return Response.json({
        data: [
          {
            type: 'party',
            id: 'p9',
            name: 'Tio Jorge',
            guests: 2,
            trashedAt: '2026-11-20T12:00:00Z',
            purgeAt: '2026-12-20',
          },
        ],
      });
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
}

describe('Convidados no casamento bloqueado (Bloqueado RN02 a RN04)', () => {
  it('Novo grupo e Importar planilha desabilitados com o motivo', async () => {
    mockGuests();
    renderRoute({ url: '/app/convidados' });
    for (const name of ['Novo grupo', 'Importar planilha']) {
      const button = await screen.findByRole('button', { name });
      expect(button).toBeDisabled();
      expect(button).toHaveAccessibleDescription(LOCKED);
    }
  });

  it('sem marcar grupos: as ações em lote são escrita (Penpot 05, "— bloqueado")', async () => {
    mockGuests();
    renderRoute({ url: '/app/convidados' });
    expect(
      await screen.findByRole('checkbox', { name: 'Selecionar Família Moreira' }),
    ).toBeDisabled();
  });

  it('no ⋮ da linha, Editar e Mover para a lixeira desabilitados; Abrir e Copiar link, não', async () => {
    const user = userEvent.setup();
    mockGuests();
    renderRoute({ url: '/app/convidados' });
    await user.click(await screen.findByRole('button', { name: 'Ações de Família Moreira' }));
    for (const name of ['Editar grupo', 'Mover para a lixeira']) {
      const item = screen.getByRole('menuitem', { name });
      expect(item).toHaveAttribute('aria-disabled', 'true');
      expect(item).toHaveAccessibleDescription(LOCKED);
    }
    for (const name of ['Abrir', 'Copiar link']) {
      expect(screen.getByRole('menuitem', { name })).not.toHaveAttribute('aria-disabled', 'true');
    }
  });

  it('nas tags, Criar tag e Editar desabilitados; o Editar segue citando a tag', async () => {
    mockGuests();
    renderRoute({ url: '/app/convidados/tags' });
    const edit = await screen.findByRole('button', { name: 'Editar' });
    expect(edit).toBeDisabled();
    expect(edit).toHaveAccessibleDescription(`Padrinhos ${LOCKED}`);
    expect(screen.getByRole('button', { name: 'Criar tag' })).toHaveAccessibleDescription(LOCKED);
  });

  it('na lixeira, Restaurar desabilitado com o item e o motivo', async () => {
    mockGuests();
    renderRoute({ url: '/app/convidados/lixeira' });
    const restore = await screen.findByRole('button', { name: 'Restaurar' });
    expect(restore).toBeDisabled();
    expect(restore.getAttribute('aria-describedby')).toContain('kore-trash-locked');
  });

  it('o 403 WEDDING_BLOCKED em corrida: o Toast com o motivo, no lugar do genérico', async () => {
    const user = userEvent.setup();
    mockGuests({
      blocked: false,
      createTag: () => Response.json({ error: 'WEDDING_BLOCKED' }, { status: 403 }),
    });
    renderRoute({ url: '/app/convidados/tags' });
    await user.type(await screen.findByRole('textbox', { name: 'Nome da tag nova' }), 'Amigos');
    await user.click(screen.getByRole('button', { name: 'Criar tag' }));
    const region = await screen.findByRole('region', { name: /^Avisos/ });
    expect(await within(region).findByText(LOCKED)).toBeInTheDocument();
    expect(within(region).queryByText(/^Não foi possível continuar/)).toBeNull();
  });

  it('no Novo grupo, o Salvar grupo desabilitado com o motivo', async () => {
    mockGuests();
    renderRoute({ url: '/app/convidados/novo' });
    const save = await screen.findByRole('button', { name: 'Salvar grupo' });
    expect(save).toBeDisabled();
    expect(save).toHaveAccessibleDescription(LOCKED);
    // Os campos em leitura (sugestão do Crivo), e o Cancelar continua.
    expect(screen.getByRole('textbox', { name: 'Nome do grupo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
  });

  it('no Importar, o campo da planilha e o Colar a lista desabilitados com o motivo (as prévias já gravam)', async () => {
    mockGuests();
    renderRoute({ url: '/app/convidados/importar' });
    const paste = await screen.findByRole('button', { name: 'Colar a lista' });
    expect(paste).toBeDisabled();
    expect(paste).toHaveAccessibleDescription(LOCKED);
    const upload = screen.getByRole('group', { name: '2. Enviar a planilha preenchida' });
    expect(upload).toHaveAccessibleDescription(LOCKED);
    expect(upload.querySelector('input[type="file"]')).toBeDisabled();
  });

  it('a lista colada: a prévia recusada em corrida vira o Toast, e o Continuar trava pelo /me relido', async () => {
    const user = userEvent.setup();
    let blocked = false;
    mockApi(({ method, path }) => {
      if (path === '/v1/me') return Response.json(meFor(me(blocked)));
      if (method === 'GET' && path.startsWith('/v1/weddings/w1/parties')) {
        return Response.json({ summary, total: 1, data: [PARTY], nextCursor: null });
      }
      if (method === 'GET' && path === '/v1/weddings/w1/tags') {
        return Response.json({ limit: 10, data: [] });
      }
      if (method === 'POST' && path === '/v1/weddings/w1/guest-imports/paste/preview') {
        blocked = true;
        return Response.json({ error: 'WEDDING_BLOCKED' }, { status: 403 });
      }
      return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
    });
    renderRoute({ url: '/app/convidados/importar' });
    await user.click(await screen.findByRole('button', { name: 'Colar a lista' }));
    await user.type(screen.getByRole('textbox', { name: 'Colar a lista' }), 'Família Moreira');
    const next = screen.getByRole('button', { name: 'Continuar' });
    await user.click(next);
    const region = await screen.findByRole('region', { name: /^Avisos/ });
    expect(await within(region).findByText(LOCKED)).toBeInTheDocument();
    await waitFor(() => expect(next).toBeDisabled());
    expect(next).toHaveAccessibleDescription(LOCKED);
  });
});
