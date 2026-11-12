import { Button, FileUpload, Progress } from '@kore-io/design';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Audience } from '../../guests/hooks/use-active-wedding';
import type { BasicsDraft } from '../basics-draft';
import { IMAGE_ACCEPT, useSiteImageUpload } from '../images/use-site-image-upload';

/**
 * A foto de capa dos Dados básicos (RN09; Penpot 1.2): sem foto, a área de envio; com
 * foto, a miniatura com Trocar foto · Remover foto; embaixo, o aviso fixo. A troca só
 * vale ao Salvar (vai no PATCH com o resto da seção).
 */
export function CoverField({
  weddingId,
  audience,
  cover,
  coupleNames,
  onChange,
}: {
  weddingId: string;
  audience: Audience;
  cover: BasicsDraft['cover'];
  coupleNames: string;
  onChange: (cover: BasicsDraft['cover']) => void;
}) {
  const { t } = useTranslation('site');
  const upload = useSiteImageUpload({ weddingId, audience });
  const picker = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  async function send(file: File) {
    setProgress(0);
    const image = await upload({ file, onProgress: setProgress });
    setProgress(null);
    if (image) onChange({ id: image.id, url: image.url, thumbUrl: image.thumbUrl });
  }

  return (
    <div className="kore-site-cover" role="group" aria-labelledby="kore-site-cover-label">
      <span id="kore-site-cover-label" className="kore-site-cover__label">
        {t('basics.cover')}
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
          <img className="kore-site-cover__thumb" src={cover.thumbUrl} alt={coupleNames} />
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
      <p className="kore-site-cover__help">{t('basics.coverHelp')}</p>
    </div>
  );
}
