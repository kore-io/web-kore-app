import { getExportControllerExportV1Url } from '../../shared/api/generated/guests/guests';
import type { ExportControllerExportV1Params } from '../../shared/api/generated/model';
import { downloadFile } from '../../shared/api/download-file';

/** Baixa a exportação (RN01: na hora, sem fila), com o nome do Content-Disposition (RN09). */
export function downloadExport({
  weddingId,
  params,
}: {
  weddingId: string;
  params: ExportControllerExportV1Params;
}): Promise<void> {
  return downloadFile({ path: getExportControllerExportV1Url(weddingId, params) });
}
