import { Button, Dialog } from '@kore-io/design';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';

interface TrashDialogProps {
  open: boolean;
  title: string;
  description: string;
  isPending: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  onConfirm: () => void;
}

/** Dialog Destrutivo do Mover para a lixeira (Lixeira RN02): Cancelar · Mover para a lixeira. */
export function TrashDialog({
  open,
  title,
  description,
  isPending,
  returnFocusRef,
  onClose,
  onConfirm,
}: TrashDialogProps) {
  const { t } = useTranslation('guests');
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={title}
      description={description}
      {...(returnFocusRef && { returnFocusRef })}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('trash.cancel')}
          </Button>
          <Button variant="destructive" disabled={isPending} onClick={onConfirm}>
            {t('trash.action')}
          </Button>
        </>
      }
    />
  );
}
