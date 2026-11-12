import { ToastProvider } from '@kore-io/design';
import { act, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiError, mockApi } from '../../../../tests/render-route';
import { compressImage } from './compress-image';
import { putFile } from './put-file';
import { useSiteImageUpload } from './use-site-image-upload';

vi.mock('./compress-image', async (original) => ({
  ...(await original<typeof import('./compress-image')>()),
  compressImage: vi.fn(),
}));
vi.mock('./put-file', () => ({ putFile: vi.fn() }));

const compressed = new Blob(['x'.repeat(1000)], { type: 'image/jpeg' });
const ready = {
  id: 'img1',
  status: 'ready',
  url: 'https://cdn/d.jpg',
  thumbUrl: 'https://cdn/t.jpg',
  width: 2560,
  height: 1707,
};

function wrapper({ children }: { children: ReactNode }) {
  return (
    <ToastProvider label="Avisos" dismissLabel="Fechar">
      {children}
    </ToastProvider>
  );
}

const jpeg = (size = 2_000) => new File([new Uint8Array(size)], 'foto.jpg', { type: 'image/jpeg' });

beforeEach(() => {
  vi.mocked(compressImage).mockResolvedValue(compressed);
  vi.mocked(putFile).mockResolvedValue();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function mockUpload({
  authorize = () =>
    Response.json(
      {
        imageId: 'img1',
        uploadUrl: 'http://s3/put',
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '1000' },
        expiresAt: '2026-11-11T12:05:00Z',
      },
      { status: 201 },
    ),
  confirm = () => Response.json(ready),
}: { authorize?: () => Response; confirm?: () => Response } = {}) {
  const calls: { path: string; body: unknown }[] = [];
  mockApi(({ path, body }) => {
    calls.push({ path, body });
    if (path.endsWith('/upload-authorizations')) return authorize();
    if (path.endsWith('/site-images')) return confirm();
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

async function run(file: File, audience: 'couple' | 'planner' = 'couple') {
  const { result } = renderHook(() => useSiteImageUpload({ weddingId: 'w1', audience }), {
    wrapper,
  });
  let image: unknown;
  await act(async () => {
    image = await result.current({ file });
  });
  return image;
}

describe('envio de foto do site (Imagens RN02 a RN07)', () => {
  it('comprime, pede a autorização com o tamanho do JPEG, envia e confirma', async () => {
    const calls = mockUpload();
    expect(await run(jpeg())).toEqual(ready);
    expect(calls).toEqual([
      {
        path: '/v1/weddings/w1/site-images/upload-authorizations',
        body: { contentType: 'image/jpeg', sizeBytes: 1000 },
      },
      { path: '/v1/weddings/w1/site-images', body: { imageId: 'img1' } },
    ]);
    expect(putFile).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://s3/put',
        blob: compressed,
        contentType: 'image/jpeg',
      }),
    );
  });

  it('outro tipo não sai do aparelho (RN02)', async () => {
    const calls = mockUpload();
    expect(await run(new File(['x'], 'a.gif', { type: 'image/gif' }))).toBeNull();
    expect(
      await screen.findByText('Não foi possível usar esta foto. Escolham uma foto JPG ou PNG.'),
    ).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('acima de 25 MB, o aviso do tamanho, no singular para a cerimonialista (RN03)', async () => {
    mockUpload();
    expect(await run(jpeg(25 * 1024 * 1024 + 1), 'planner')).toBeNull();
    expect(
      await screen.findByText('Esta foto passa de 25 MB. Escolha uma foto menor.'),
    ).toBeInTheDocument();
  });

  it('o limite de 40 e o 429 (RN07)', async () => {
    mockUpload({ authorize: () => apiError({ status: 409, body: { error: 'SITE_IMAGE_LIMIT' } }) });
    await run(jpeg());
    expect(
      await screen.findByText(
        'Muitas fotos foram trocadas neste site hoje. Tentem de novo amanhã.',
      ),
    ).toBeInTheDocument();
    mockUpload({
      authorize: () => apiError({ status: 429, body: { error: 'Too Many Requests' } }),
    });
    await run(jpeg());
    expect(
      await screen.findByText('Muitas fotos ao mesmo tempo. Esperem um minuto e tentem de novo.'),
    ).toBeInTheDocument();
  });

  it('a falha de rede no envio e a foto que o servidor não lê (RN04, RN05)', async () => {
    mockUpload();
    vi.mocked(putFile).mockRejectedValueOnce(new Error('rede'));
    await run(jpeg());
    expect(
      await screen.findByText(
        'Não foi possível enviar a foto. Confiram a conexão e tentem de novo.',
      ),
    ).toBeInTheDocument();
    mockUpload({ confirm: () => apiError({ status: 422, body: { error: 'IMAGE_INVALID' } }) });
    await run(jpeg());
    expect(
      await screen.findAllByText('Não foi possível usar esta foto. Escolham uma foto JPG ou PNG.'),
    ).not.toHaveLength(0);
  });

  it('a imagem que o navegador não consegue ler conta como tipo errado', async () => {
    mockUpload();
    vi.mocked(compressImage).mockRejectedValueOnce(new Error('decode'));
    expect(await run(jpeg())).toBeNull();
    expect(
      await screen.findByText('Não foi possível usar esta foto. Escolham uma foto JPG ou PNG.'),
    ).toBeInTheDocument();
  });
});
