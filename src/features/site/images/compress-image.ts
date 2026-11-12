/** Lado maior e peso do arquivo que o app envia (Imagens RN03). */
export const MAX_SIDE = 2560;
export const MAX_BYTES = 4 * 1024 * 1024;
/** O arquivo de origem pode ter até 25 MB (RN03). */
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
/** Mira cerca de 1 MB: começa nessa qualidade e desce até caber em 4 MB. */
const QUALITIES = [0.85, 0.75, 0.65, 0.5, 0.4];

/**
 * Comprime no aparelho (RN03): até 2560 px no lado maior, em JPEG, com a orientação do
 * EXIF aplicada e sem os metadados (o canvas não os copia). Devolve nulo se não couber
 * em 4 MB nem na qualidade mais baixa.
 */
export async function compressImage(file: Blob): Promise<Blob | null> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  // PNG com transparência: o fundo vira branco no JPEG, em vez de preto.
  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  for (const quality of QUALITIES) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (blob && blob.size <= MAX_BYTES) return blob;
  }
  return null;
}
