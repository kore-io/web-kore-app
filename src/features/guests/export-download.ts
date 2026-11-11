import { getExportControllerExportV1Url } from '../../shared/api/generated/guests/guests';
import type { ExportControllerExportV1Params } from '../../shared/api/generated/model';
import { ApiError, apiUrl } from '../../shared/api/http-client';

/**
 * O nome do arquivo no Content-Disposition (RN09): o `filename*` em UTF-8 e, sem ele, o
 * `filename`. A API expõe o cabeçalho no CORS (decisão 212(4)).
 */
export function fileNameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded.trim());
    } catch {
      // cai no filename simples
    }
  }
  return /filename="([^"]+)"/i.exec(header)?.[1] ?? null;
}

/**
 * Baixa a exportação (RN01: na hora, sem fila). O cliente do Orval lê o corpo como texto,
 * o que estraga o arquivo; aqui o corpo vem como Blob e vira um link de download. O erro
 * vem em ApiError, como nos hooks gerados.
 */
export async function downloadExport({
  weddingId,
  params,
}: {
  weddingId: string;
  params: ExportControllerExportV1Params;
}): Promise<void> {
  const response = await fetch(
    apiUrl({ path: getExportControllerExportV1Url(weddingId, params) }),
    {
      credentials: 'include',
    },
  );
  if (!response.ok) {
    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // corpo sem JSON
    }
    throw new ApiError({ status: response.status, body });
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileNameFromDisposition(response.headers.get('Content-Disposition')) ?? '';
  document.body.append(link);
  link.click();
  link.remove();
  // Depois do clique: o navegador já pegou o arquivo.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
