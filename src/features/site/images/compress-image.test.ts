import { afterEach, describe, expect, it, vi } from 'vitest';
import { compressImage, MAX_BYTES, MAX_SIDE } from './compress-image';

/** O jsdom não tem canvas nem createImageBitmap: os dois entram simulados. */
function setup({ width, height, sizes }: { width: number; height: number; sizes: number[] }) {
  const close = vi.fn();
  const createImageBitmap = vi.fn(async () => ({ width, height, close }));
  vi.stubGlobal('createImageBitmap', createImageBitmap);
  const context = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() };
  const canvas = document.createElement('canvas');
  const qualities: number[] = [];
  let call = 0;
  vi.spyOn(canvas, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(canvas, 'toBlob').mockImplementation((callback, type, quality) => {
    expect(type).toBe('image/jpeg');
    qualities.push(quality ?? 0);
    const size = sizes[Math.min(call++, sizes.length - 1)] ?? 0;
    callback(new Blob([new Uint8Array(size)], { type: 'image/jpeg' }));
  });
  const create = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
    tag === 'canvas' ? canvas : create(tag),
  );
  return { canvas, context, createImageBitmap, close, qualities };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('compressão no aparelho (Imagens RN03)', () => {
  it('reduz o lado maior a 2560 px, aplica a orientação do EXIF e gera JPEG com fundo branco', async () => {
    const { canvas, context, createImageBitmap, close, qualities } = setup({
      width: 5120,
      height: 3840,
      sizes: [1_000_000],
    });
    const file = new Blob(['x'], { type: 'image/png' });
    const blob = await compressImage(file);
    expect(createImageBitmap).toHaveBeenCalledWith(file, { imageOrientation: 'from-image' });
    expect([canvas.width, canvas.height]).toEqual([MAX_SIDE, 1920]);
    expect(context.fillStyle).toBe('#FFFFFF');
    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2560, 1920);
    expect(close).toHaveBeenCalled();
    expect(qualities).toEqual([0.85]);
    expect(blob?.type).toBe('image/jpeg');
  });

  it('uma foto menor que 2560 px mantém o tamanho', async () => {
    const { canvas } = setup({ width: 1200, height: 1600, sizes: [500_000] });
    await compressImage(new Blob(['x']));
    expect([canvas.width, canvas.height]).toEqual([1200, 1600]);
  });

  it('desce a qualidade até caber em 4 MB', async () => {
    const { qualities } = setup({
      width: 2560,
      height: 1707,
      sizes: [MAX_BYTES + 1, MAX_BYTES + 1, MAX_BYTES],
    });
    const blob = await compressImage(new Blob(['x']));
    expect(qualities).toEqual([0.85, 0.75, 0.65]);
    expect(blob?.size).toBe(MAX_BYTES);
  });

  it('sem caber em 4 MB nem na qualidade mais baixa, devolve nulo', async () => {
    const { qualities } = setup({ width: 2560, height: 1707, sizes: [MAX_BYTES + 1] });
    expect(await compressImage(new Blob(['x']))).toBeNull();
    expect(qualities).toEqual([0.85, 0.75, 0.65, 0.5, 0.4]);
  });
});
