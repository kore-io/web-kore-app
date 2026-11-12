import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { profileUnderTest } from '../../../../tests/profile';
import { renderAreaScreen, renderRoute } from '../../../../tests/render-route';
import { putFile } from '../images/put-file';
import { mockSite, siteWith, withSection } from './section-test-fixtures';

vi.mock('../site-fonts', () => ({ loadEditorFonts: vi.fn(async () => undefined) }));
vi.mock('../images/compress-image', async (original) => ({
  ...(await original<typeof import('../images/compress-image')>()),
  compressImage: vi.fn(async () => new Blob(['x'], { type: 'image/jpeg' })),
}));
vi.mock('../images/put-file', () => ({ putFile: vi.fn(async () => undefined) }));

const photo = (id: string) => ({
  id,
  url: `https://cdn/${id}/display.jpg`,
  thumbUrl: `https://cdn/${id}/thumb.jpg`,
  width: 2560,
  height: 1707,
});

const storyWith = (ids: string[], text = 'A gente se conheceu em 2019.') =>
  siteWith({
    sections: withSection({
      type: 'story',
      title: 'Nossa história',
      content: { text, images: ids.map(photo) },
      enabled: true,
      empty: false,
    }),
  });

const jpg = (name: string) => new File(['x'], name, { type: 'image/jpeg' });
const save = () => screen.getByRole('button', { name: 'Salvar' });

describe('Site › Nossa história (S3 RN05; S4 RN04)', () => {
  it('o texto, as fotos com o alt pelo título, a ajuda e a área de envio do Penpot', async () => {
    mockSite({ site: storyWith(['a', 'b']) });
    renderRoute({ url: '/app/site/nossa-historia' });
    const group = await screen.findByRole('group', { name: 'Fotos do casal (2 de 12)' });
    expect(
      within(group).getByRole('img', { name: 'Foto 1 de 2 de Nossa história' }),
    ).toHaveAttribute('src', 'https://cdn/a/thumb.jpg');
    expect(within(group).getByRole('button', { name: 'Remover foto 2' })).toBeInTheDocument();
    expect(
      within(group).getByLabelText(
        'Arrastem as fotos ou cliquem para escolher JPG ou PNG, até 12 fotos.',
      ),
    ).toHaveAttribute('multiple');
    expect(
      screen.getByText('Esta seção é pública: é aqui que vão as fotos do ensaio.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Texto' })).toHaveAttribute('maxlength', '5000');
  });

  it('várias fotos sobem uma de cada vez, entram na ordem e vão como imageIds ao salvar (RN05)', async () => {
    const user = userEvent.setup();
    const calls = mockSite({ site: storyWith(['a']) });
    renderRoute({ url: '/app/site/nossa-historia' });
    const drop = await screen.findByLabelText(/Arrastem as fotos/);
    await user.upload(drop, [jpg('1.jpg'), jpg('2.jpg'), jpg('3.jpg')]);
    expect(
      await screen.findByRole('group', { name: 'Fotos do casal (4 de 12)' }),
    ).toBeInTheDocument();
    expect(putFile).toHaveBeenCalledTimes(3);
    expect(vi.mocked(putFile).mock.calls.map(([args]) => args.url)).toEqual([
      'http://s3/put/new1',
      'http://s3/put/new2',
      'http://s3/put/new3',
    ]);
    expect(screen.getByRole('img', { name: 'Foto 4 de 4 de Nossa história' })).toHaveAttribute(
      'src',
      'https://cdn/new3/thumb.jpg',
    );
    await user.click(screen.getByRole('button', { name: 'Remover foto 1' }));
    await user.click(save());
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.body).toEqual({
      enabled: true,
      title: 'Nossa história',
      content: { text: 'A gente se conheceu em 2019.', imageIds: ['new1', 'new2', 'new3'] },
    });
    expect(await screen.findByText('Alterações salvas.')).toBeInTheDocument();
  });

  it('enquanto as fotos sobem: "Enviando 1 de 3", a barra por foto e o Salvar travado (S4 RN04)', async () => {
    const user = userEvent.setup();
    let release: () => void = () => undefined;
    vi.mocked(putFile).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    mockSite({ site: storyWith([], 'Texto.') });
    renderRoute({ url: '/app/site/nossa-historia' });
    await user.type(await screen.findByRole('textbox', { name: 'Texto' }), ' Mais.');
    await user.upload(screen.getByLabelText(/Arrastem as fotos/), [
      jpg('1.jpg'),
      jpg('2.jpg'),
      jpg('3.jpg'),
    ]);
    expect(await screen.findByText('Enviando 1 de 3')).toBeInTheDocument();
    expect(screen.getAllByRole('progressbar')).toHaveLength(3);
    expect(save()).toBeDisabled();
    expect(screen.getByLabelText(/Arrastem as fotos/)).toBeDisabled();
    release();
    expect(
      await screen.findByRole('group', { name: 'Fotos do casal (3 de 12)' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(save()).toBeEnabled());
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('com 11, só a primeira de duas entra; com 12, a área mostra o limite de cada perfil (RN05)', async () => {
    const user = userEvent.setup();
    const eleven = Array.from({ length: 11 }, (_, index) => `p${index + 1}`);
    mockSite({ site: storyWith(eleven) });
    const { unmount } = renderRoute({ url: '/app/site/nossa-historia' });
    await user.upload(await screen.findByLabelText(/Arrastem as fotos/), [
      jpg('1.jpg'),
      jpg('2.jpg'),
    ]);
    expect(
      await screen.findByRole('group', { name: 'Fotos do casal (12 de 12)' }),
    ).toBeInTheDocument();
    expect(putFile).toHaveBeenCalledTimes(1);
    const full = screen.getByLabelText(
      'Vocês já têm 12 fotos, o limite da seção. Removam uma para incluir outra. JPG ou PNG, até 12 fotos.',
    );
    expect(full).toBeDisabled();
    unmount();
    profileUnderTest.current = 'planner';
    mockSite({ site: storyWith([...eleven, 'p12']) });
    renderAreaScreen({ url: '/app/site/nossa-historia' });
    expect(
      await screen.findByLabelText(
        'Esta seção já tem 12 fotos, o limite. Remova uma para incluir outra. JPG ou PNG, até 12 fotos.',
      ),
    ).toBeDisabled();
  });

  it('a foto que não é JPG nem PNG não entra, com o Toast do tipo (S4 RN02)', async () => {
    const user = userEvent.setup({ applyAccept: false });
    mockSite({ site: storyWith([]) });
    renderRoute({ url: '/app/site/nossa-historia' });
    await user.upload(await screen.findByLabelText(/Arrastem as fotos/), [
      new File(['x'], 'foto.gif', { type: 'image/gif' }),
    ]);
    expect(
      await screen.findByText('Não foi possível usar esta foto. Escolham uma foto JPG ou PNG.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Fotos do casal (0 de 12)' })).toBeInTheDocument();
  });

  it('o alt acompanha o título da seção (Imagens RN09)', async () => {
    const user = userEvent.setup();
    mockSite({ site: storyWith(['a']) });
    renderRoute({ url: '/app/site/nossa-historia' });
    const title = await screen.findByRole('textbox', { name: 'Título da seção' });
    await user.clear(title);
    await user.type(title, 'Como tudo começou');
    expect(
      screen.getByRole('img', { name: 'Foto 1 de 1 de Como tudo começou' }),
    ).toBeInTheDocument();
  });

  it('é acessível', async () => {
    mockSite({ site: storyWith(['a', 'b', 'c']) });
    const { container } = renderRoute({ url: '/app/site/nossa-historia' });
    await screen.findByRole('group', { name: 'Fotos do casal (3 de 12)' });
    await expectNoA11yViolations({ container });
  });
});
