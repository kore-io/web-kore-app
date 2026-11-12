import { Button, FileUpload, Progress } from '@kore-io/design';
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Audience } from '../../guests/hooks/use-active-wedding';
import type { SiteImageRefResponse } from '../../../shared/api/generated/model';
import { IMAGE_ACCEPT, useSiteImageUpload } from '../images/use-site-image-upload';

export type ImageValue = Pick<SiteImageRefResponse, 'id' | 'url' | 'thumbUrl'> | null;

/**
 * Uma foto do site no Editor: a capa dos Dados básicos (RN09) e a foto de referência do
 * Dress code (Seções RN09). Sem foto, a área de envio; com foto, a miniatura com Trocar
 * foto · Remover foto; embaixo, a ajuda, quando houver. A troca só vale ao Salvar.
 */
export function ImageField({
  weddingId,
  audience,
  label,
  help,
  image: cover,
  alt,
  onChange,
}: {
  weddingId: string;
  audience: Audience;
  label: string;
  help?: string;
  image: ImageValue;
  /** O texto alternativo da miniatura (Imagens RN09). */
  alt: string;
  onChange: (image: ImageValue) => void;
}) {
  const { t } = useTranslation('site');
  const upload = useSiteImageUpload({ weddingId, audience });
  const picker = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const labelId = useId();

  async function send(file: File) {
    setProgress(0);
    const image = await upload({ file, onProgress: setProgress });
    setProgress(null);
    if (image) onChange({ id: image.id, url: image.url, thumbUrl: image.thumbUrl });
  }

  return (
    <div className="kore-site-cover" role="group" aria-labelledby={labelId}>
      <span id={labelId} className="kore-site-cover__label">
        {label}
      </span>
      {progress !== null ? (
        <div className="kore-site-cover__sending">
          <Progress
            label={t('images.sending', { current: 1, total: 1 })}
            value={Math.round(progress * 100)}
          />
        </div>
      ) : cover ? (
        <div className="kore-site-cover__current">
          <img className="kore-site-cover__thumb" src={cover.thumbUrl} alt={alt} />
          <div className="kore-site-cover__actions">
            <Button variant="secondary" size="sm" onClick={() => picker.current?.click()}>
              {t('images.change')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
              {t('images.remove')}
            </Button>
          </div>
          <input
            ref={picker}
            type="file"
            accept={IMAGE_ACCEPT}
            className="kore-site-cover__picker"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void send(file);
            }}
          />
        </div>
      ) : (
        <FileUpload
          title={t(`images.drop.${audience}`)}
          hint={t('images.dropHint')}
          accept={IMAGE_ACCEPT}
          onFile={(file) => void send(file)}
        />
      )}
      {help !== undefined && <p className="kore-site-cover__help">{help}</p>}
    </div>
  );
}
