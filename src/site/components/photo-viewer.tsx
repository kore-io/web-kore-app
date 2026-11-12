import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export interface ViewerPhoto {
  url: string;
  alt: string;
}

/**
 * O visualizador das fotos de Nossa história (Seções RN05; decisão 222): a foto grande num
 * `<dialog>` modal, com Fechar, Foto anterior, Próxima foto e "{n} de {total}". As setas
 * do teclado trocam a foto, e o Esc fecha (do próprio `<dialog>`).
 */
export function PhotoViewer({
  photos,
  index,
  onIndexChange,
  onClose,
}: {
  photos: readonly ViewerPhoto[];
  /** A foto aberta; nulo, o visualizador fica fechado. */
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('publicSite');
  const dialog = useRef<HTMLDialogElement>(null);
  const open = index !== null;

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  const photo = index === null ? undefined : photos[index];
  const total = photos.length;
  const go = (by: -1 | 1) => {
    if (index === null) return;
    onIndexChange((index + by + total) % total);
  };

  return (
    <dialog
      ref={dialog}
      className="kore-site-viewer"
      aria-label={photo?.alt}
      onClose={onClose}
      onKeyDown={(event) => {
        if (total < 2) return;
        if (event.key === 'ArrowLeft') go(-1);
        if (event.key === 'ArrowRight') go(1);
      }}
    >
      {photo && index !== null && (
        <div className="kore-site-viewer__frame">
          <img className="kore-site-viewer__image" src={photo.url} alt={photo.alt} />
          <div className="kore-site-viewer__bar">
            {total > 1 && (
              <button
                type="button"
                className="kore-site-viewer__button"
                aria-label={t('viewer.previous')}
                onClick={() => go(-1)}
              >
                <ChevronLeft aria-hidden="true" />
              </button>
            )}
            <span className="kore-site-viewer__counter">
              {t('viewer.counter', { n: index + 1, total })}
            </span>
            {total > 1 && (
              <button
                type="button"
                className="kore-site-viewer__button"
                aria-label={t('viewer.next')}
                onClick={() => go(1)}
              >
                <ChevronRight aria-hidden="true" />
              </button>
            )}
          </div>
          <button
            type="button"
            className="kore-site-viewer__close"
            aria-label={t('viewer.close')}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </div>
      )}
    </dialog>
  );
}
