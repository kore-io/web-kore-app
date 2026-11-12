import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { meFor, profileUnderTest } from '../../../../tests/profile';
import { apiError, mockApi, renderAreaScreen, renderRoute } from '../../../../tests/render-route';
import type { SiteEditorResponse } from '../../../shared/api/generated/model';
import { me, siteWith } from '../../site/sections/section-test-fixtures';

type Call = { method: string; path: string; body: unknown };

function site(overrides: Record<string, unknown> = {}): SiteEditorResponse {
  return {
    ...siteWith(),
    publication: { courtesyEnabled: true, endDateMin: '2026-11-15', endDateMax: '2027-11-14' },
    ...overrides,
  } as SiteEditorResponse;
}

function mockPublish({
  data = site(),
  publish = () =>
    Response.json({
      status: 'published',
      publishedAt: '2026-11-12T13:00:00Z',
      endDate: '2027-02-14',
      publicationSource: 'courtesy',
    }),
}: { data?: SiteEditorResponse; publish?: () => Response } = {}) {
  const calls: Call[] = [];
  mockApi(({ method, path, body }) => {
    if (path === '/v1/me') return Response.json(meFor(me));
    if (path === '/v1/weddings/w1/site' && method === 'GET') return Response.json(data);
    if (path === '/v1/weddings/w1/publication' && method === 'POST') {
      calls.push({ method, path, body });
      return publish();
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

const endDate = () => screen.getByLabelText('Data de saída do ar');
const publishButton = () => screen.getByRole('button', { name: 'Publicar' });

describe('Publicar o site por Cortesia (Publicação por Cortesia RN01 a RN07; Penpot A1)', () => {
  it('os textos do Penpot, a data vazia ao abrir e o aviso da trava do endereço (228(3))', async () => {
    mockPublish();
    renderRoute({ url: '/app/cobranca/publicar' });
    expect(await screen.findByRole('heading', { name: 'Publicar o site' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'O site vai ao ar agora, sem pagamento. A partir daí, cada grupo abre o próprio link e confirma a presença.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Escolham até quando o site fica no ar.')).toBeInTheDocument();
    expect(endDate()).toHaveValue('');
    expect(endDate()).toHaveAccessibleDescription('Depois do casamento e até 14 de nov. de 2027.');
    expect(endDate()).toHaveAttribute('min', '2026-11-15');
    expect(endDate()).toHaveAttribute('max', '2027-11-14');
    expect(
      screen.getByText('Depois de publicar, o endereço kore.com.br/ana-e-marcos não muda mais.'),
    ).toBeInTheDocument();
    expect(publishButton()).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  it('publica com a data escolhida, volta ao Dashboard e mostra "Site publicado." (RN05, RN07)', async () => {
    const user = userEvent.setup();
    const calls = mockPublish();
    const { router } = renderRoute({ url: '/app/cobranca/publicar' });
    await user.type(await screen.findByLabelText('Data de saída do ar'), '2027-02-14');
    await user.click(publishButton());
    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
    expect(calls).toEqual([
      { method: 'POST', path: '/v1/weddings/w1/publication', body: { endDate: '2027-02-14' } },
    ]);
    expect(await screen.findByText('Site publicado.')).toBeInTheDocument();
  });

  it('sem data ou fora dos limites: o erro do campo, sem chamar a API (RN04)', async () => {
    const user = userEvent.setup();
    const calls = mockPublish();
    renderRoute({ url: '/app/cobranca/publicar' });
    await screen.findByLabelText('Data de saída do ar');
    await user.click(publishButton());
    const error = 'Escolham uma data depois do casamento e até 14 de nov. de 2027.';
    expect(endDate()).toHaveAccessibleDescription(error);
    expect(endDate()).toHaveAttribute('aria-invalid', 'true');
    await user.type(endDate(), '2027-12-14');
    expect(endDate()).toHaveAccessibleDescription('Depois do casamento e até 14 de nov. de 2027.');
    await user.click(publishButton());
    expect(endDate()).toHaveAccessibleDescription(error);
    expect(calls).toHaveLength(0);
  });

  it('o 422 do servidor volta ao campo com o limite dele (RN04)', async () => {
    const user = userEvent.setup();
    mockPublish({
      publish: () =>
        apiError({
          status: 422,
          body: {
            statusCode: 422,
            error: 'END_DATE_OUT_OF_RANGE',
            message: 'x',
            endDateMin: '2026-11-15',
            endDateMax: '2027-10-01',
          },
        }),
    });
    renderRoute({ url: '/app/cobranca/publicar' });
    await user.type(await screen.findByLabelText('Data de saída do ar'), '2027-11-14');
    await user.click(publishButton());
    await waitFor(() =>
      expect(endDate()).toHaveAccessibleDescription(
        'Escolham uma data depois do casamento e até 1 de out. de 2027.',
      ),
    );
  });

  it('duas publicações ao mesmo tempo: o 409 NOT_DRAFT diz "O site já está publicado." (RN05)', async () => {
    const user = userEvent.setup();
    mockPublish({
      publish: () =>
        apiError({ status: 409, body: { statusCode: 409, error: 'NOT_DRAFT', message: 'x' } }),
    });
    renderRoute({ url: '/app/cobranca/publicar' });
    await user.type(await screen.findByLabelText('Data de saída do ar'), '2027-02-14');
    await user.click(publishButton());
    expect(await screen.findByText('O site já está publicado.')).toBeInTheDocument();
  });

  it('a colaboradora vê o Publicar desabilitado, com o motivo (RN02)', async () => {
    profileUnderTest.current = 'planner';
    mockPublish();
    renderAreaScreen({ url: '/app/cobranca/publicar' });
    expect(await screen.findByRole('button', { name: 'Publicar' })).toBeDisabled();
    expect(publishButton()).toHaveAccessibleDescription('Só o casal pode publicar e pagar.');
  });

  it.each([
    [
      'sem endereço (RN03)',
      { slug: null },
      'Escolham o endereço do site em Dados básicos para publicar.',
    ],
    [
      'a Cortesia desligada (RN01)',
      { publication: { courtesyEnabled: false, endDateMin: null, endDateMax: null } },
      'A publicação ainda não está disponível. Se precisar publicar agora, escreva para suporte@kore.com.br.',
    ],
    [
      'sem data do casamento (RN04)',
      {
        eventDate: null,
        publication: { courtesyEnabled: true, endDateMin: null, endDateMax: null },
      },
      'Informem a data do casamento em Dados básicos para publicar.',
    ],
    [
      'sem UF, sem fuso (RN04)',
      {
        timezone: null,
        publication: { courtesyEnabled: true, endDateMin: null, endDateMax: null },
      },
      'Informem a data e a UF do casamento em Dados básicos para publicar.',
    ],
    [
      'o casal ainda não aceitou (RN03)',
      { status: 'awaiting_couple' },
      'O casal ainda não aceitou o convite.',
    ],
  ])('%s: o Publicar desabilitado com o texto ao lado (228(4))', async (_case, change, text) => {
    mockPublish({ data: site(change) });
    renderRoute({ url: '/app/cobranca/publicar' });
    expect(await screen.findByRole('button', { name: 'Publicar' })).toBeDisabled();
    expect(publishButton()).toHaveAccessibleDescription(text);
  });

  it('já publicado, o caminho volta ao Dashboard (228(2))', async () => {
    mockPublish({ data: site({ status: 'published', publishedAt: '2026-11-12T13:00:00Z' }) });
    const { router } = renderRoute({ url: '/app/cobranca/publicar' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
  });

  it('Cancelar aberta direto volta ao Dashboard, sem publicar', async () => {
    const user = userEvent.setup();
    const calls = mockPublish();
    const { router } = renderRoute({ url: '/app/cobranca/publicar' });
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
    expect(calls).toHaveLength(0);
  });

  it('é acessível', async () => {
    mockPublish();
    const { container } = renderRoute({ url: '/app/cobranca/publicar' });
    await screen.findByRole('heading', { name: 'Publicar o site' });
    await expectNoA11yViolations({ container });
  });
});
