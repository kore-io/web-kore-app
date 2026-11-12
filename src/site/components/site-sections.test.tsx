import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../tests/a11y';
import type { PublicSectionResponse } from '../../shared/api/generated/model';
import { SiteSections } from './site-sections';

const image = (id: string) => ({
  url: `https://cdn/${id}/display.jpg`,
  thumbUrl: `https://cdn/${id}/thumb.jpg`,
  width: 2560,
  height: 1707,
});

const sections = [
  { type: 'countdown', content: {} },
  {
    type: 'story',
    title: 'Como tudo começou',
    content: {
      text: 'A gente se conheceu em 2019.\n\nCinco anos depois,\nele acertou o pedido.',
      images: [image('a'), image('b'), image('c')],
    },
  },
  { type: 'ceremony', title: 'Cerimônia & Recepção', locked: true, content: {} },
  {
    type: 'lodging',
    title: 'Hospedagem e transporte',
    content: { text: '<b>oi</b> veja www.exemplo.com' },
  },
  {
    type: 'dress_code',
    title: 'Dress code',
    content: { text: 'Passeio completo.', image: image('d') },
  },
  {
    type: 'faq',
    title: 'Perguntas frequentes',
    content: {
      items: [
        { question: 'E se chover?', answer: 'Há área coberta.' },
        { question: 'Qual é o traje?', answer: 'Passeio completo.' },
        { question: 'Tem estacionamento?', answer: 'Sim, com manobrista.' },
      ],
    },
  },
] as unknown as PublicSectionResponse[];

describe('Site do casal › seções do Início (Seções RN04 a RN10; decisão 222)', () => {
  it('as seções na ordem, sem a contagem, com o sobretítulo do Penpot (a Hospedagem sem) e a âncora do menu', () => {
    render(<SiteSections sections={sections} />);
    const regions = screen.getAllByRole('region');
    expect(regions.map((region) => region.id)).toEqual([
      'nossa-historia',
      'cerimonia-e-recepcao',
      'hospedagem-e-transporte',
      'dress-code',
      'faq',
    ]);
    expect(
      regions.map(
        (region) =>
          region.getAttribute('aria-labelledby') &&
          within(region).getByRole('heading', { level: 2 }).textContent,
      ),
    ).toEqual([
      'Como tudo começou',
      'Cerimônia & Recepção',
      'Hospedagem e transporte',
      'Dress code',
      'Perguntas frequentes',
    ]);
    expect(screen.getByText('Nossa história')).toBeInTheDocument();
    expect(screen.getByText('O grande dia')).toBeInTheDocument();
    expect(screen.getByText('Para a festa')).toBeInTheDocument();
    expect(screen.getByText('Dúvidas')).toBeInTheDocument();
    expect(within(regions[2] as HTMLElement).queryByText(/^[A-ZÀ-Ú ]+$/)).not.toBeInTheDocument();
    expect(within(regions[2] as HTMLElement).getAllByRole('heading')).toHaveLength(1);
  });

  it('o texto do casal: parágrafos pela linha em branco, a quebra fica, e nada vira HTML nem link (RN04)', () => {
    const { container } = render(<SiteSections sections={sections} />);
    const story = container.querySelector('#nossa-historia') as HTMLElement;
    const paragraphs = story.querySelectorAll('.kore-site-text');
    expect(Array.from(paragraphs).map((p) => p.textContent)).toEqual([
      'A gente se conheceu em 2019.',
      'Cinco anos depois,\nele acertou o pedido.',
    ]);
    const lodging = container.querySelector('#hospedagem-e-transporte') as HTMLElement;
    expect(within(lodging).getByText('<b>oi</b> veja www.exemplo.com')).toBeInTheDocument();
    expect(lodging.querySelector('b')).toBeNull();
    expect(within(lodging).queryByRole('link')).not.toBeInTheDocument();
  });

  it('Nossa história: as fotos com o alt pelo título, e o visualizador com as setas, o contador e o Fechar (RN05)', async () => {
    const user = userEvent.setup();
    render(<SiteSections sections={sections} />);
    await user.click(screen.getByRole('img', { name: 'Foto 2 de 3 de Como tudo começou' }));
    const viewer = screen.getByRole('dialog', { name: 'Foto 2 de 3 de Como tudo começou' });
    expect(within(viewer).getByRole('img')).toHaveAttribute('src', 'https://cdn/b/display.jpg');
    expect(within(viewer).getByText('2 de 3')).toBeInTheDocument();
    await user.click(within(viewer).getByRole('button', { name: 'Próxima foto' }));
    expect(within(viewer).getByText('3 de 3')).toBeInTheDocument();
    await user.click(within(viewer).getByRole('button', { name: 'Próxima foto' }));
    expect(within(viewer).getByText('1 de 3')).toBeInTheDocument();
    await user.keyboard('{ArrowLeft}');
    expect(within(viewer).getByText('3 de 3')).toBeInTheDocument();
    await user.click(within(viewer).getByRole('button', { name: 'Foto anterior' }));
    expect(within(viewer).getByText('2 de 3')).toBeInTheDocument();
    await user.click(within(viewer).getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Cerimônia para o visitante: o cartão fechado, sem local nem horário (RN07)', () => {
    const { container } = render(<SiteSections sections={sections} />);
    const ceremony = container.querySelector('#cerimonia-e-recepcao') as HTMLElement;
    expect(
      within(ceremony).getByText('Entre pelo link do seu convite para ver o local e o horário.'),
    ).toBeInTheDocument();
    expect(
      within(ceremony).getByText('O link chegou junto com o convite do casal.'),
    ).toBeInTheDocument();
    expect(within(ceremony).queryByRole('link')).not.toBeInTheDocument();
  });

  it('Dress code com a foto de referência e o alt (RN09; Imagens RN09)', () => {
    render(<SiteSections sections={sections} />);
    expect(screen.getByRole('img', { name: 'Foto de referência do dress code' })).toHaveAttribute(
      'src',
      'https://cdn/d/display.jpg',
    );
  });

  it('FAQ em sanfona: começam fechadas, cada uma abre e fecha sozinha (RN10)', async () => {
    const user = userEvent.setup();
    render(<SiteSections sections={sections} />);
    const buttons = screen
      .getAllByRole('button', { expanded: false })
      .filter((b) => b.closest('.kore-site-faq'));
    expect(buttons.map((b) => b.textContent)).toEqual([
      'E se chover?',
      'Qual é o traje?',
      'Tem estacionamento?',
    ]);
    expect(
      screen.queryByText('Passeio completo.', { selector: '.kore-site-faq p' }),
    ).not.toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Qual é o traje?' }));
    expect(screen.getByRole('button', { name: 'Qual é o traje?' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText('Passeio completo.', { selector: '.kore-site-faq p' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'E se chover?' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByText('Há área coberta.')).not.toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Qual é o traje?' }));
    expect(screen.getByRole('button', { name: 'Qual é o traje?' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('Nossa história só com texto, sem fotos', () => {
    const textOnly = [
      { type: 'story', title: 'Nossa história', content: { text: 'Oi.', images: [] } },
    ] as unknown as PublicSectionResponse[];
    render(<SiteSections sections={textOnly} />);
    expect(screen.getByText('Oi.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('é acessível', async () => {
    const { container } = render(<SiteSections sections={sections} />);
    await expectNoA11yViolations({ container });
  });
});
