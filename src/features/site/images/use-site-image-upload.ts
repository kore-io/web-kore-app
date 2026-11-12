import { useToast } from '@kore-io/design';
import { useTranslation } from 'react-i18next';
import {
  siteImagesControllerAuthorizeV1,
  siteImagesControllerConfirmV1,
} from '../../../shared/api/generated/site-images/site-images';
import type { SiteImageResponse } from '../../../shared/api/generated/model';
import { ApiError, apiErrorCode } from '../../../shared/api/http-client';
import type { Audience } from '../../guests/hooks/use-active-wedding';
import { compressImage, MAX_SOURCE_BYTES } from './compress-image';
import { putFile } from './put-file';

const ACCEPTED = ['image/jpeg', 'image/png'];
export const IMAGE_ACCEPT = '.jpg,.jpeg,.png,image/jpeg,image/png';

type UploadFailure = 'type' | 'tooBig' | 'network' | 'limit' | 'rate' | 'generic';

/**
 * Envio de uma foto do site (Imagens RN02 a RN07): confere o tipo (JPG ou PNG) e os
 * 25 MB no aparelho, comprime para JPEG, pede a autorização, envia direto ao
 * armazenamento e confirma; a confirmação devolve a imagem pronta. Cada falha vira o
 * Toast do perfil, e a função devolve nulo.
 */
export function useSiteImageUpload({
  weddingId,
  audience,
}: {
  weddingId: string;
  audience: Audience;
}) {
  const { t } = useTranslation('site');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();

  function fail(failure: UploadFailure) {
    showToast({
      tone: 'danger',
      message:
        failure === 'generic'
          ? `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`
          : t(`images.errors.${failure}.${audience}`),
    });
    return null;
  }

  return async function upload({
    file,
    onProgress,
  }: {
    file: File;
    onProgress?: (fraction: number) => void;
  }): Promise<SiteImageResponse | null> {
    if (!ACCEPTED.includes(file.type)) return fail('type');
    if (file.size > MAX_SOURCE_BYTES) return fail('tooBig');
    let blob: Blob | null;
    try {
      blob = await compressImage(file);
    } catch {
      // O navegador não conseguiu ler a imagem: o arquivo não é uma foto válida.
      return fail('type');
    }
    if (!blob) return fail('tooBig');

    let authorization;
    try {
      authorization = await siteImagesControllerAuthorizeV1(weddingId, {
        contentType: 'image/jpeg',
        sizeBytes: blob.size,
      });
    } catch (error) {
      return fail(failureOf(error));
    }
    try {
      await putFile({
        url: authorization.uploadUrl,
        blob,
        contentType: 'image/jpeg',
        ...(onProgress && { onProgress }),
      });
    } catch {
      return fail('network');
    }
    try {
      onProgress?.(1);
      return await siteImagesControllerConfirmV1(weddingId, { imageId: authorization.imageId });
    } catch (error) {
      // A foto que o servidor não consegue ler cai no mesmo texto do tipo (RN05).
      return fail(apiErrorCode({ error }) === 'IMAGE_INVALID' ? 'type' : failureOf(error));
    }
  };
}

function failureOf(error: unknown): UploadFailure {
  const code = apiErrorCode({ error });
  if (code === 'SITE_IMAGE_LIMIT') return 'limit';
  if (error instanceof ApiError && error.status === 429) return 'rate';
  if (!(error instanceof ApiError)) return 'network';
  return 'generic';
}
