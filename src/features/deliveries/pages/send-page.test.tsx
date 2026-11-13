import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { meFor, profileUnderTest } from '../../../../tests/profile';
import { apiError, mockApi, renderAreaScreen, renderRoute } from '../../../../tests/render-route';

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

const party = (id: string, name: string, overrides: object = {}) => ({
  id,
  name,
  contact: { guestId: `${id}g`, name: `${name} contato`, phoneMasked: '(19) 9****-3310' },
  firstGuestName: name,
  people: 2,
  counts: { confirmed: 0, declined: 0, pending: 2, pendingPlusOnes: 0 },
  deliveryStatus: 'not_sent',
  respondedAt: null,
  respondedBy: null,
  lastResponse: null,
  tags: [],
  ...overrides,
});

const PARTIES = [party('p1', 'Família Moreira'), party('p2', 'Tio Jorge')];
const DEFAULT_INVITE =
  'Oi, {nome_do_grupo}! Vamos nos casar no dia {data}, em Campinas, e contamos com a sua presença.\nA confirmação é por este link: {link}\n\nCom carinho, Ana e Marcos';

const queueItem = (id: string, name: string, overrides: object = {}) => ({
  id,
  name,
  deliveryStatus: 'not_sent',
  sentAt: null,
  lastChannel: null,
  saveTheDateSentAt: null,
  lastReminderAt: null,
  contact: {
    guestId: `${id}g`,
    name: 'Célia Moreira',
    phoneMasked: '(19) 9****-3310',
    emailMasked: 'ce***@gmail.com',
  },
  whatsappUrl: `https://wa.me/5519998763310?text=${id}`,
  mailtoUrl: `mailto:celia@gmail.com?subject=x&body=${id}`,
  copyText: `Oi, ${name}! A confirmação é por este link: https://kore.com.br/ana-e-marcos/grupo/${id}`,
  ...overrides,
});

type Call = { method: string; path: string; body: unknown };

function mockSend({
  status = 'published',
  parties = PARTIES,
  queue = [queueItem('p1', 'Família Moreira'), queueItem('p2', 'Tio Jorge', { whatsappUrl: null })],
  template = {
    kind: 'invite',
    subject: 'Convite do casamento de Ana & Marcos',
    body: DEFAULT_INVITE,
    isDefault: true,
  },
  qrError,
}: {
  status?: string;
  parties?: object[];
  queue?: object[];
  template?: object;
  qrError?: { status: number; body: Record<string, unknown> };
} = {}) {
  const calls: Call[] = [];
  let current = template;
  mockApi(({ method, path, body }) => {
    if (path === '/v1/me') return Response.json(meFor(me));
    if (path === '/v1/weddings/w1/dashboard') {
      return Response.json({
        rsvpDeadline: '2026-10-15',
        site: { status },
        delivery: { notSent: 6, sent: 40, viewed: 8, responded: 4 },
        reminderQueue: { parties: 0, guests: 0, notReminded: 0 },
      });
    }
    if (path.startsWith('/v1/weddings/w1/tags')) return Response.json({ data: [], limit: 10 });
    if (path.startsWith('/v1/weddings/w1/parties') && method === 'GET') {
      calls.push({ method, path, body });
      return Response.json({
        data: parties,
        total: parties.length,
        nextCursor: null,
        summary: null,
      });
    }
    if (path === '/v1/weddings/w1/message-templates') {
      return Response.json({
        items: [current, { ...current, kind: 'save_the_date' }, { ...current, kind: 'reminder' }],
      });
    }
    if (path.startsWith('/v1/weddings/w1/message-templates/') && method === 'PUT') {
      calls.push({ method, path, body });
      const data = body as { reset?: boolean; body?: string };
      current = data.reset ? template : { ...current, body: data.body ?? '', isDefault: false };
      return Response.json(current);
    }
    if (path.startsWith('/v1/weddings/w1/deliveries/queue')) {
      calls.push({ method, path, body });
      const ids = new URLSearchParams(path.split('?')[1]).get('partyIds')?.split(',') ?? [];
      return Response.json({
        kind: 'invite',
        subject: 'Convite',
        skippedPartyIds: [],
        items: queue.filter((item) => ids.includes((item as { id: string }).id)),
      });
    }
    if (path === '/v1/weddings/w1/parties/qr-codes' && method === 'POST') {
      calls.push({ method, path, body });
      if (qrError) return apiError(qrError);
      const pdf = (body as { format: string }).format === 'pdf';
      return new Response(new Blob(['qr']), {
        headers: {
          'Content-Type': pdf ? 'application/pdf' : 'image/png',
          'Content-Disposition': `attachment; filename="qr-ana-e-marcos.${pdf ? 'pdf' : 'png'}"`,
        },
      });
    }
    if (path === '/v1/weddings/w1/deliveries' && method === 'POST') {
      calls.push({ method, path, body });
      return Response.json({ parties: [] });
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

function preset(ids: string[], channel = 'whatsapp', kind = 'invite') {
  window.sessionStorage.setItem(`kore.deliveries.w1.${kind}`, JSON.stringify({ ids, channel }));
}

beforeEach(() => window.sessionStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('Envios › as abas e os grupos (Envios RN01, RN03, RN04, RN10; decisão 235)', () => {
  it('/app/envios abre em Enviar convites, com as 4 abas e o resumo', async () => {
    const calls = mockSend();
    const { router } = renderRoute({ url: '/app/envios' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/envios/convites'));
    expect(
      await screen.findByText(
        '52 de 58 grupos já receberam o convite · prazo de resposta: 15 de out.',
      ),
    ).toBeInTheDocument();
    const tabs = screen.getByRole('navigation', { name: 'Envios' });
    expect(
      within(tabs)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([
      'Enviar convitesConvites',
      'Save the dateSave the date',
      'Lembrar pendentesLembrar',
      'Prazo de respostaPrazo',
    ]);
    // O convite abre no "não enviado" (RN03).
    await waitFor(() =>
      expect(calls.some((call) => call.path.includes('sent=not_sent'))).toBe(true),
    );
  });

  it('marca grupos, "2 grupos marcados" e Continuar leva ao canal', async () => {
    const user = userEvent.setup();
    mockSend();
    const { router } = renderRoute({ url: '/app/envios/convites' });
    const continueButton = await screen.findByRole('button', { name: 'Continuar' });
    expect(continueButton).toBeDisabled();
    expect(screen.getByText('0 grupos marcados')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Etapas' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Etapas' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['1Grupos', '2Canal e mensagem', '3Fila de envio']);
    await user.click(await screen.findByRole('checkbox', { name: /Família Moreira/ }));
    await user.click(screen.getByRole('checkbox', { name: /Tio Jorge/ }));
    expect(screen.getByText('2 grupos marcados')).toBeInTheDocument();
    await user.click(continueButton);
    await waitFor(() => expect(router.state.location.search).toBe('?etapa=canal'));
  });

  it('antes de publicar: a legenda com o link, e Continuar desabilitado; a cerimonialista, sem o link', async () => {
    mockSend({ status: 'draft' });
    preset(['p1']);
    const view = renderRoute({ url: '/app/envios/convites' });
    const continueButton = await screen.findByRole('button', { name: 'Continuar' });
    expect(continueButton).toBeDisabled();
    expect(continueButton).toHaveAccessibleDescription(/Publiquem o site para começar os envios\./);
    expect(screen.getByRole('link', { name: 'Publicar o site' })).toHaveAttribute(
      'href',
      '/app/cobranca/publicar',
    );
    view.unmount();
    profileUnderTest.current = 'planner';
    mockSend({ status: 'draft' });
    renderAreaScreen({ url: '/app/envios/convites' });
    expect(
      await screen.findByText('Os envios começam depois que o casal publicar o site.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Publicar o site' })).toBeNull();
  });

  it('acima de 200 marcados: o limite e Continuar desabilitado (RN10)', async () => {
    mockSend();
    preset(Array.from({ length: 201 }, (_, index) => `x${index}`));
    renderRoute({ url: '/app/envios/convites' });
    expect(
      await screen.findByText('Vocês marcaram 201 grupos. Marquem até 200 por envio.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  });

  it('o lembrete: só a fila (remind=true), o cabeçalho e o vazio (RN04)', async () => {
    const calls = mockSend();
    const view = renderRoute({ url: '/app/envios/lembrete' });
    expect(await screen.findByText('2 grupos com convidados sem resposta')).toBeInTheDocument();
    expect(calls.some((call) => call.path.includes('remind=true'))).toBe(true);
    view.unmount();
    mockSend({ parties: [] });
    renderRoute({ url: '/app/envios/lembrete' });
    expect(await screen.findByText('Nenhum grupo para lembrar')).toBeInTheDocument();
    expect(
      screen.getByText('Todos os que receberam o convite já responderam.'),
    ).toBeInTheDocument();
  });
});

describe('Lembrar pendentes vindo da lista (Envios RN04; Penpot A9)', () => {
  it('os marcados fora da fila do lembrete ficam de fora, com a linha; seguem só os que entram', async () => {
    const user = userEvent.setup();
    mockSend();
    preset(['p1', 'p2', 'x1', 'x2'], 'whatsapp', 'reminder');
    const { router } = renderRoute({ url: '/app/envios/lembrete' });
    expect(
      await screen.findByText(
        '2 grupos marcados não entram no lembrete: ainda não receberam o convite ou já responderam.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('2 grupos marcados')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(router.state.location.search).toBe('?etapa=canal'));
    expect(
      JSON.parse(window.sessionStorage.getItem('kore.deliveries.w1.reminder') ?? '{}').ids,
    ).toEqual(['p1', 'p2']);
  });
});

describe('Envios › canal e mensagem (Envios RN05, RN06)', () => {
  it('a mensagem padrão, a ajuda, a prévia com o 1º grupo e o {link} obrigatório', async () => {
    const user = userEvent.setup();
    mockSend();
    preset(['p1', 'p2']);
    renderRoute({ url: '/app/envios/convites?etapa=canal' });
    const message = await screen.findByRole('textbox', { name: 'Mensagem' });
    expect(message).toHaveValue(DEFAULT_INVITE);
    expect(message).toHaveAccessibleDescription(
      'Usem {nome_do_grupo}, {data} e {link}. O Kore troca cada um pelos dados do grupo.',
    );
    expect(message).toHaveAttribute('maxlength', '1000');
    expect(await screen.findByText('Prévia · Família Moreira')).toBeInTheDocument();
    expect(
      screen.getByText('É assim que o grupo recebe. O link é só deste grupo.'),
    ).toBeInTheDocument();
    // Sem o Restaurar enquanto é a padrão.
    expect(screen.queryByRole('button', { name: 'Restaurar a mensagem padrão' })).toBeNull();
    await user.clear(message);
    await user.type(message, 'Oi, venha!');
    expect(message).toHaveAccessibleDescription(
      'A mensagem precisa ter o {link}, senão o grupo não consegue responder. Coloquem o {link} de volta.',
    );
    expect(screen.getByRole('button', { name: 'Ir para a fila (2 grupos)' })).toBeDisabled();
    // Mexeu na mensagem padrão: o Restaurar aparece e volta ao texto guardado.
    await user.click(screen.getByRole('button', { name: 'Restaurar a mensagem padrão' }));
    expect(message).toHaveValue(DEFAULT_INVITE);
  });

  it('no e-mail, o Assunto; editar e Ir para a fila guarda a mensagem e abre a fila', async () => {
    const user = userEvent.setup();
    const calls = mockSend();
    preset(['p1']);
    const { router } = renderRoute({ url: '/app/envios/convites?etapa=canal' });
    await user.click(await screen.findByRole('radio', { name: /^E-.mail$/ }));
    expect(screen.getByRole('textbox', { name: 'Assunto' })).toHaveValue(
      'Convite do casamento de Ana & Marcos',
    );
    const message = screen.getByRole('textbox', { name: 'Mensagem' });
    await user.type(message, ' Até lá!');
    expect(screen.getByRole('group', { name: 'Canal' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ir para a fila (1 grupo)' }));
    await waitFor(() => expect(router.state.location.search).toBe('?etapa=fila'));
    expect(calls.find((call) => call.method === 'PUT')).toEqual({
      method: 'PUT',
      path: '/v1/weddings/w1/message-templates/invite',
      body: { body: `${DEFAULT_INVITE} Até lá!`, subject: 'Convite do casamento de Ana & Marcos' },
    });
  });

  it('a mensagem editada mostra o Restaurar, que volta à padrão', async () => {
    const user = userEvent.setup();
    const calls = mockSend({
      template: { kind: 'invite', subject: 'Convite', body: 'Oi! {link}', isDefault: false },
    });
    preset(['p1']);
    renderRoute({ url: '/app/envios/convites?etapa=canal' });
    await user.click(await screen.findByRole('button', { name: 'Restaurar a mensagem padrão' }));
    await waitFor(() =>
      expect(calls.find((call) => call.method === 'PUT')?.body).toEqual({ reset: true }),
    );
  });
});

describe('Envios › a fila (Envios RN07, RN08)', () => {
  it('o aviso do WhatsApp, o contador e o clique abre o wa.me e marca o envio com keepalive', async () => {
    const user = userEvent.setup();
    const open = vi.fn();
    vi.stubGlobal('open', open);
    const calls = mockSend();
    preset(['p1', 'p2']);
    renderRoute({ url: '/app/envios/convites?etapa=fila' });
    expect(
      await screen.findByText(
        'O WhatsApp abre a seguir, com a mensagem pronta. O ideal é enviar do número de uma das pessoas do casal.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('0 de 2 enviados')).toBeInTheDocument();
    const card = screen.getByText('Família Moreira').closest('li') as HTMLElement;
    expect(within(card).getByText('Célia Moreira · (19) 9****-3310')).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Abrir WhatsApp' }));
    expect(open).toHaveBeenCalledWith('https://wa.me/5519998763310?text=p1', '_blank', 'noopener');
    await waitFor(() =>
      expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
        kind: 'invite',
        channel: 'whatsapp',
        partyIds: ['p1'],
      }),
    );
    expect(within(card).getByText(/^Enviado às \d+h(\d{2})? pelo WhatsApp$/)).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Enviar de novo' })).toBeInTheDocument();
    expect(within(card).getByText('Enviado')).toBeInTheDocument();
    expect(screen.getByText('1 de 2 enviados')).toBeInTheDocument();
  });

  it('o grupo sem telefone: o aviso e Editar grupo, sem o botão do canal', async () => {
    mockSend();
    preset(['p1', 'p2']);
    renderRoute({ url: '/app/envios/convites?etapa=fila' });
    const card = (await screen.findByText('Tio Jorge')).closest('li') as HTMLElement;
    expect(
      within(card).getByText(
        'O contato deste grupo não tem telefone. Adicionem um para enviar pelo WhatsApp.',
      ),
    ).toBeInTheDocument();
    expect(
      within(card)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Editar grupo']);
  });

  it('Copiar link: copia a mensagem, o Toast e "Mensagem copiada às …"', async () => {
    const user = userEvent.setup();
    mockSend();
    preset(['p1'], 'link');
    renderRoute({ url: '/app/envios/convites?etapa=fila' });
    await user.click(await screen.findByRole('button', { name: 'Copiar mensagem' }));
    expect(await screen.findByText('Mensagem copiada.')).toBeInTheDocument();
    await expect(navigator.clipboard.readText()).resolves.toContain('Oi, Família Moreira!');
    expect(screen.getByText(/^Mensagem copiada às /)).toBeInTheDocument();
  });

  it('Editar grupo, no grupo sem telefone, abre o Editar grupo', async () => {
    const user = userEvent.setup();
    mockSend();
    preset(['p2']);
    const { router } = renderRoute({ url: '/app/envios/convites?etapa=fila' });
    await user.click(await screen.findByRole('button', { name: 'Editar grupo' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/app/convidados/grupos/p2/editar'),
    );
  });

  it('depois de editar a mensagem, a fila de vários grupos é lida de novo (RN06, RN07)', async () => {
    const user = userEvent.setup();
    const calls = mockSend();
    preset(['p1', 'p2']);
    const { router } = renderRoute({ url: '/app/envios/convites?etapa=fila' });
    await screen.findByText('0 de 2 enviados');
    const queueReads = () =>
      calls.filter(
        (call) => call.path.includes('partyIds=p1%2Cp2') || call.path.includes('partyIds=p1,p2'),
      ).length;
    expect(queueReads()).toBe(1);
    await router.navigate('/app/envios/convites?etapa=canal');
    const message = await screen.findByRole('textbox', { name: 'Mensagem' });
    await user.type(message, ' Até lá!');
    await user.click(screen.getByRole('button', { name: 'Ir para a fila (2 grupos)' }));
    await waitFor(() => expect(router.state.location.search).toBe('?etapa=fila'));
    await screen.findByText('0 de 2 enviados');
    await waitFor(() => expect(queueReads()).toBe(2));
  });

  it('Parar e continuar depois volta aos grupos da aba', async () => {
    const user = userEvent.setup();
    mockSend();
    preset(['p1']);
    const { router } = renderRoute({ url: '/app/envios/convites?etapa=fila' });
    await user.click(await screen.findByRole('button', { name: 'Parar e continuar depois' }));
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(router.state.location.pathname).toBe('/app/envios/convites');
  });

  it('é acessível', async () => {
    mockSend();
    preset(['p1', 'p2']);
    const { container } = renderRoute({ url: '/app/envios/convites?etapa=fila' });
    await screen.findByText('Família Moreira');
    await expectNoA11yViolations({ container });
  });
});

describe('Envios › QR code (Envios RN09; Penpot A6)', () => {
  let clicked: { href: string; download: string }[] = [];
  beforeEach(() => {
    clicked = [];
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: () => 'blob:kore/qr', revokeObjectURL: vi.fn() }),
    );
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push({ href: this.getAttribute('href') ?? '', download: this.download });
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('o QR code só existe no convite; escolhido, a etapa fica sem a mensagem', async () => {
    const user = userEvent.setup();
    mockSend();
    preset(['p1', 'p2']);
    const view = renderRoute({ url: '/app/envios/convites?etapa=canal' });
    await screen.findByRole('textbox', { name: 'Mensagem' });
    const channels = screen.getByRole('group', { name: 'Canal' });
    expect(
      within(channels)
        .getAllByRole('radio')
        .map((radio) => radio.parentElement?.textContent?.replace(/\u2060/g, '')),
    ).toEqual(['WhatsApp', 'E-mail', 'Copiar link', 'QR code']);
    await user.click(within(channels).getByRole('radio', { name: 'QR code' }));
    expect(screen.queryByRole('textbox', { name: 'Mensagem' })).toBeNull();
    expect(screen.queryByText('Prévia · Família Moreira')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Ir para a fila (2 grupos)' }));
    expect(await screen.findByRole('button', { name: 'Baixar PDF para impressão' })).toBeEnabled();
    view.unmount();
    preset(['p1'], 'whatsapp', 'reminder');
    renderRoute({ url: '/app/envios/lembrete?etapa=canal' });
    await screen.findByRole('textbox', { name: 'Mensagem' });
    expect(screen.queryByRole('radio', { name: 'QR code' })).toBeNull();
  });

  it('vários grupos: a lista sem cartões, o PDF e o Toast com o número (RN09)', async () => {
    const user = userEvent.setup();
    const calls = mockSend({
      queue: [
        queueItem('p1', 'Família Moreira'),
        queueItem('p2', 'Tio Jorge', {
          contact: { guestId: 'p2g', name: 'Jorge', phoneMasked: null, emailMasked: 'jo***@x.com' },
        }),
      ],
    });
    preset(['p1', 'p2'], 'qr');
    renderRoute({ url: '/app/envios/convites?etapa=fila' });
    const download = await screen.findByRole('button', { name: 'Baixar PDF para impressão' });
    // Sem o aviso do WhatsApp, o contador e os botões por grupo.
    expect(screen.queryByText(/O WhatsApp abre a seguir/)).toBeNull();
    expect(screen.queryByText(/enviados$/)).toBeNull();
    expect(screen.getAllByRole('button').map((button) => button.textContent)).not.toContain(
      'Abrir WhatsApp',
    );
    expect(screen.getByText('Célia Moreira · (19) 9****-3310')).toBeInTheDocument();
    expect(screen.getByText('Jorge · jo***@x.com')).toBeInTheDocument();
    await user.click(download);
    expect(
      await screen.findByText('QR code baixado. 2 grupos marcados como enviados.'),
    ).toBeInTheDocument();
    expect(calls.find((call) => call.path.endsWith('/qr-codes'))?.body).toEqual({
      partyIds: ['p1', 'p2'],
      format: 'pdf',
    });
    expect(clicked).toEqual([{ href: 'blob:kore/qr', download: 'qr-ana-e-marcos.pdf' }]);
  });

  it('um grupo: Baixar imagem (PNG) e o Toast no singular', async () => {
    const user = userEvent.setup();
    const calls = mockSend();
    preset(['p1'], 'qr');
    renderRoute({ url: '/app/envios/convites?etapa=fila' });
    await user.click(await screen.findByRole('button', { name: 'Baixar imagem (PNG)' }));
    expect(
      await screen.findByText('QR code baixado. O grupo foi marcado como enviado.'),
    ).toBeInTheDocument();
    expect(calls.find((call) => call.path.endsWith('/qr-codes'))?.body).toEqual({
      partyIds: ['p1'],
      format: 'png',
    });
    expect(clicked).toEqual([{ href: 'blob:kore/qr', download: 'qr-ana-e-marcos.png' }]);
  });

  it('a recusa do servidor: o Toast de erro, sem baixar e sem o Toast do QR', async () => {
    const user = userEvent.setup();
    mockSend({
      qrError: { status: 409, body: { error: 'DELIVERIES_CLOSED', reason: 'not_published' } },
    });
    preset(['p1', 'p2'], 'qr');
    renderRoute({ url: '/app/envios/convites?etapa=fila' });
    await user.click(await screen.findByRole('button', { name: 'Baixar PDF para impressão' }));
    expect(await screen.findByText(/^Não foi possível continuar/)).toBeInTheDocument();
    expect(screen.queryByText(/^QR code baixado/)).toBeNull();
    expect(clicked).toEqual([]);
  });

  it('é acessível', async () => {
    mockSend();
    preset(['p1', 'p2'], 'qr');
    const { container } = renderRoute({ url: '/app/envios/convites?etapa=fila' });
    await screen.findByText('Família Moreira');
    await expectNoA11yViolations({ container });
  });
});
