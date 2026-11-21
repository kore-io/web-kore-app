import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { profileUnderTest } from '../../../../tests/profile';
import { renderAreaScreen, renderRoute } from '../../../../tests/render-route';
import {
  mockSite,
  siteWith,
  withSection,
  type Call,
} from '../../site/sections/section-test-fixtures';

vi.mock('../../site/site-fonts', () => ({ loadEditorFonts: vi.fn(async () => undefined) }));

const PLANNER = { organization: 'Prado Assessoria', weddingsCount: 1 };

function template({
  id,
  kind,
  sectionType = null,
  name,
  content,
}: {
  id: string;
  kind: 'section_content' | 'faq' | 'appearance';
  sectionType?: string | null;
  name: string;
  content: Record<string, unknown>;
}) {
  return {
    id,
    kind,
    sectionType,
    name,
    locale: 'pt-BR',
    content,
    createdAt: '2026-11-10T12:00:00Z',
    updatedAt: '2026-11-10T12:00:00Z',
  };
}

const STORY = template({
  id: 't1',
  kind: 'section_content',
  sectionType: 'story',
  name: 'Nossa história: tom acolhedor',
  content: { text: '{casal} se conheceram em {cidade}, e casam em {data}.' },
});

/** A colaboradora com o perfil de cerimonialista, no Editor do casamento em que colabora. */
function asPlanner(options: Parameters<typeof mockSite>[0] = {}) {
  profileUnderTest.current = 'planner';
  return mockSite({ planner: PLANNER, ...options });
}

const applyButton = () => screen.findByRole('button', { name: 'Aplicar modelo' });
const puts = (calls: Call[]) => calls.filter((call) => call.method === 'PUT');

async function choose({ name }: { name: string | RegExp }) {
  const user = userEvent.setup();
  await user.click(await applyButton());
  const picker = await screen.findByRole('dialog', { name: 'Aplicar modelo' });
  await user.click(await within(picker).findByRole('button', { name }));
  return user;
}

describe('Aplicar modelo no Editor (Modelos RN07, RN08)', () => {
  it('troca só o texto, com os marcadores, depois da confirmação; nada é gravado até Salvar', async () => {
    const queries: string[] = [];
    const calls = asPlanner({
      site: siteWith({
        sections: withSection({
          type: 'story',
          title: 'Como tudo começou',
          content: {
            text: 'Texto antigo.',
            images: [
              {
                id: 'img1',
                url: 'https://cdn/img1/display.jpg',
                thumbUrl: 'https://cdn/img1/thumb.jpg',
                width: 2560,
                height: 1707,
              },
            ],
          },
          enabled: true,
          empty: false,
        }),
      }),
      templates: (query) => {
        queries.push(query.toString());
        return [STORY];
      },
    });
    renderAreaScreen({ url: '/app/site/nossa-historia' });
    const user = await choose({ name: /Nossa história: tom acolhedor/ });
    // Nos Textos, o seletor lê só os modelos da seção aberta.
    expect(queries).toEqual(['kind=section_content&sectionType=story']);
    const confirm = await screen.findByRole('alertdialog', {
      name: 'Aplicar "Nossa história: tom acolhedor"?',
    });
    expect(confirm).toHaveAccessibleDescription(
      'O texto atual da seção Nossa história é substituído no editor. Ele só vai ao ar quando você salvar.',
    );
    await expectNoA11yViolations({ container: confirm });
    await user.click(within(confirm).getByRole('button', { name: 'Aplicar' }));
    expect(screen.getByRole('textbox', { name: 'Texto' })).toHaveValue(
      'Ana e Marcos se conheceram em Campinas, e casam em 14 de novembro de 2026.',
    );
    // O título e o Switch ficam (D17).
    expect(screen.getByRole('textbox', { name: 'Título da seção' })).toHaveValue(
      'Como tudo começou',
    );
    expect(screen.getByRole('switch', { name: 'Mostrar a seção no site' })).toBeChecked();
    expect(await screen.findByText('Modelo aplicado. Revise e salve.')).toBeInTheDocument();
    expect(puts(calls)).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    expect(puts(calls)[0]?.body).toMatchObject({
      title: 'Como tudo começou',
      content: {
        text: 'Ana e Marcos se conheceram em Campinas, e casam em 14 de novembro de 2026.',
        // A foto da seção fica (D17).
        imageIds: ['img1'],
      },
    });
  });

  it('sem data, o {data} fica no texto e o Toast avisa (RN07)', async () => {
    asPlanner({ site: siteWith({ eventDate: null }), templates: () => [STORY] });
    renderAreaScreen({ url: '/app/site/nossa-historia' });
    const user = await choose({ name: /Nossa história: tom acolhedor/ });
    await user.click(await screen.findByRole('button', { name: 'Aplicar' }));
    expect(screen.getByRole('textbox', { name: 'Texto' })).toHaveValue(
      'Ana e Marcos se conheceram em Campinas, e casam em {data}.',
    );
    expect(
      await screen.findByText(
        'Modelo aplicado. Este casamento ainda não tem data, então {data} ficou no texto. Revise e salve.',
      ),
    ).toBeInTheDocument();
  });

  it('a confirmação vem sempre, mesmo com a seção vazia; Cancelar não muda nada (RN08)', async () => {
    const lodging = template({
      id: 't2',
      kind: 'section_content',
      sectionType: 'lodging',
      name: 'Hotéis de Campinas',
      content: { text: 'Hotel Vitória, em {cidade}.' },
    });
    asPlanner({ templates: () => [lodging] });
    renderAreaScreen({ url: '/app/site/hospedagem-e-transporte' });
    const user = await choose({ name: /Hotéis de Campinas/ });
    const confirm = await screen.findByRole('alertdialog', {
      name: 'Aplicar "Hotéis de Campinas"?',
    });
    // Com a confirmação aberta, o editor fica inerte (aria-hidden), ainda sem o texto.
    expect(screen.getByRole('textbox', { name: 'Texto', hidden: true })).toHaveValue('');
    await user.click(within(confirm).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Texto' })).toHaveValue('');
    await user.click(await applyButton());
    await user.click(await screen.findByRole('button', { name: /Hotéis de Campinas/ }));
    await user.click(await screen.findByRole('button', { name: 'Aplicar' }));
    expect(screen.getByRole('textbox', { name: 'Texto' })).toHaveValue(
      'Hotel Vitória, em Campinas.',
    );
  });

  it('passou do limite depois de aplicar: o aviso e o Salvar desabilitado até encurtar (RN08)', async () => {
    const long = template({
      id: 't3',
      kind: 'section_content',
      sectionType: 'dress_code',
      name: 'Traje longo',
      // O modelo tem 1.996 caracteres; com "Ana e Marcos" no lugar de "{casal}", 2.001.
      content: { text: `${'a'.repeat(1986)}{casal}!!!` },
    });
    asPlanner({ templates: () => [long] });
    renderAreaScreen({ url: '/app/site/dress-code' });
    const user = await choose({ name: /Traje longo/ });
    await user.click(await screen.findByRole('button', { name: 'Aplicar' }));
    const text = screen.getByRole('textbox', { name: 'Texto' });
    expect(text).toHaveValue(`${'a'.repeat(1986)}Ana e Marcos!!!`);
    expect(text).toHaveAccessibleDescription(
      'O texto passa de 2.000 caracteres. Encurte antes de salvar.',
    );
    expect(text).toBeInvalid();
    // O contador continua à vista, fora do que o leitor de tela lê (decisão 302(6)).
    const counter = screen.getByText('2.001/2.000');
    expect(counter).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
    const end = (text as HTMLTextAreaElement).value.length;
    await user.type(text, '{Backspace}', {
      initialSelectionStart: end,
      initialSelectionEnd: end,
    });
    expect(text).toHaveAccessibleDescription('2.000/2.000');
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled();
  });

  it('sem modelos: o vazio e o Criar modelo, um link para Modelos numa aba nova (RN08)', async () => {
    asPlanner({ templates: () => [] });
    renderAreaScreen({ url: '/app/site/faq' });
    const user = userEvent.setup();
    await user.click(await applyButton());
    const picker = await screen.findByRole('dialog', { name: 'Aplicar modelo' });
    expect(
      await within(picker).findByText('Você ainda não tem modelos para esta seção.'),
    ).toBeInTheDocument();
    const create = within(picker).getByRole('link', { name: 'Criar modelo' });
    expect(create).toHaveAttribute('href', '/cerimonialista/modelos?aba=faq');
    expect(create).toHaveAttribute('target', '_blank');
    expect(create).toHaveAttribute('rel', 'noopener');
  });

  it('a falha ao ler os modelos: o aviso de carregamento e o Tentar de novo (RN08)', async () => {
    let fail = true;
    asPlanner({
      templates: () => (fail ? Response.json({ statusCode: 500 }, { status: 500 }) : [STORY]),
    });
    renderAreaScreen({ url: '/app/site/nossa-historia' });
    const user = userEvent.setup();
    await user.click(await applyButton());
    const picker = await screen.findByRole('dialog', { name: 'Aplicar modelo' });
    expect(await within(picker).findByText('Não foi possível continuar')).toBeInTheDocument();
    expect(within(picker).getByText('Confira sua conexão e tente de novo.')).toBeInTheDocument();
    expect(within(picker).queryByText('Carregando os modelos')).not.toBeInTheDocument();
    fail = false;
    await user.click(within(picker).getByRole('button', { name: 'Tentar de novo' }));
    expect(
      await within(picker).findByRole('button', { name: /Nossa história: tom acolhedor/ }),
    ).toBeInTheDocument();
  });

  it('FAQ: troca a lista de perguntas; o título fica, e o Salvar manda os items (RN08)', async () => {
    const faq = template({
      id: 't4',
      kind: 'faq',
      name: 'FAQ padrão',
      content: {
        questions: [
          { question: 'Pode levar criança?', answer: 'Sim.' },
          { question: 'Tem estacionamento?', answer: 'Tem, no local.' },
        ],
      },
    });
    const calls = asPlanner({
      site: siteWith({
        sections: withSection({
          type: 'faq',
          title: 'Dúvidas',
          content: { items: [{ question: 'Antiga?', answer: 'Sim.' }] },
          enabled: true,
          empty: false,
        }),
      }),
      templates: () => [faq],
    });
    renderAreaScreen({ url: '/app/site/faq' });
    const user = await choose({ name: /FAQ padrão/ });
    const confirm = await screen.findByRole('alertdialog', { name: 'Aplicar "FAQ padrão"?' });
    expect(confirm).toHaveAccessibleDescription(
      'As perguntas atuais do FAQ são substituídas no editor. Elas só vão ao ar quando você salvar.',
    );
    await user.click(within(confirm).getByRole('button', { name: 'Aplicar' }));
    const questions = screen.getAllByRole('textbox', { name: 'Pergunta' });
    expect(questions.map((field) => (field as HTMLInputElement).value)).toEqual([
      'Pode levar criança?',
      'Tem estacionamento?',
    ]);
    expect(screen.getByRole('textbox', { name: 'Título da seção' })).toHaveValue('Dúvidas');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    expect(puts(calls)[0]?.body).toMatchObject({
      title: 'Dúvidas',
      content: {
        items: [
          { question: 'Pode levar criança?', answer: 'Sim.' },
          { question: 'Tem estacionamento?', answer: 'Tem, no local.' },
        ],
      },
    });
  });

  it('Aparência: troca as fontes, as cores, o fundo e a paleta no rascunho (RN08)', async () => {
    const appearance = template({
      id: 't5',
      kind: 'appearance',
      name: 'Clássico sálvia',
      content: {
        fontPairKey: 'classico',
        starterPaletteKey: 'salvia',
        primaryColor: '#566C4B',
        accentColor: '#C9A66B',
        backgroundMode: 'light',
      },
    });
    asPlanner({ templates: () => [appearance] });
    renderAreaScreen({ url: '/app/site/aparencia' });
    const user = await choose({ name: /Clássico sálvia/ });
    const confirm = await screen.findByRole('alertdialog', { name: 'Aplicar "Clássico sálvia"?' });
    expect(confirm).toHaveAccessibleDescription(
      'As fontes, as cores e o fundo atuais são substituídos no editor. Eles só vão ao ar quando você salvar.',
    );
    await user.click(within(confirm).getByRole('button', { name: 'Aplicar' }));
    const fonts = screen.getByRole('group', { name: 'Tipografia' });
    expect(within(fonts).getByRole('radio', { name: /Clássico/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Sálvia' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Claro' })).toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Cor principal (botões)' })).toHaveValue('#566C4B');
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled();
  });
});

describe('Quem vê o Aplicar modelo (RN08)', () => {
  it('o casal não vê', async () => {
    mockSite({ templates: () => [STORY] });
    renderRoute({ url: '/app/site/nossa-historia' });
    await screen.findByRole('textbox', { name: 'Texto' });
    expect(screen.queryByRole('button', { name: 'Aplicar modelo' })).not.toBeInTheDocument();
  });

  it('a dona que também é cerimonialista não vê no próprio casamento', async () => {
    mockSite({ planner: PLANNER, templates: () => [STORY] });
    renderRoute({ url: '/app/site/nossa-historia' });
    await screen.findByRole('textbox', { name: 'Texto' });
    expect(screen.queryByRole('button', { name: 'Aplicar modelo' })).not.toBeInTheDocument();
  });

  it('o vendedor, colaborador sem o perfil de cerimonialista, não vê', async () => {
    profileUnderTest.current = 'seller';
    mockSite({ templates: () => [STORY] });
    renderAreaScreen({ url: '/app/site/aparencia' });
    await screen.findByRole('group', { name: 'Tipografia' });
    expect(screen.queryByRole('button', { name: 'Aplicar modelo' })).not.toBeInTheDocument();
  });

  it('a colaboradora cerimonialista vê nas cinco seções', async () => {
    asPlanner({ templates: () => [] });
    for (const slug of [
      'nossa-historia',
      'hospedagem-e-transporte',
      'dress-code',
      'faq',
      'aparencia',
    ]) {
      const view = renderAreaScreen({ url: `/app/site/${slug}` });
      expect(await applyButton()).toBeInTheDocument();
      view.unmount();
    }
  });
});
