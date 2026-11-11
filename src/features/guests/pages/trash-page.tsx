import { Alert, Button, EmptyState, Spinner } from '@kore-io/design';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type {
  TrashGuestItem,
  TrashPartyItem,
  TrashTagItem,
} from '../../../shared/api/generated/model';
import { LoadErrorNotice } from '../../../shared/components/load-error';
import { useActiveWedding, type Audience } from '../hooks/use-active-wedding';
import { useTrashList } from '../hooks/use-trash-list';

/** Prazo da lixeira (Lixeira RN10): o purgeAt é a data da remoção mais 30 dias. */
const TRASH_DAYS = 30;

/** "2026-10-21" → "21/10"; e a data da remoção, 30 dias antes, no mesmo fuso (o do casamento). */
export function trashDates({ purgeAt }: { purgeAt: string }) {
  const [year = 0, month = 1, day = 1] = purgeAt.split('-').map(Number);
  const short = (date: Date) =>
    `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  return {
    purge: short(new Date(Date.UTC(year, month - 1, day))),
    removed: short(new Date(Date.UTC(year, month - 1, day - TRASH_DAYS))),
  };
}

type TrashItem = TrashPartyItem | TrashGuestItem | TrashTagItem;

/** Aba Lixeira (Lixeira de convidados, RN08 e RN09), dentro do GuestsLayout. */
export function TrashPage() {
  const { weddingId, audience } = useActiveWedding();
  if (!weddingId) return null;
  return <TrashView weddingId={weddingId} audience={audience} />;
}

function TrashView({ weddingId, audience }: { weddingId: string; audience: Audience }) {
  const { t } = useTranslation('guests');
  const trash = useTrashList({ weddingId, audience });

  if (trash.isLoading) {
    return (
      <div className="kore-guests__loading">
        <Spinner label={t('trashPage.loading')} />
      </div>
    );
  }
  if (trash.isError) return <LoadErrorNotice onRetry={trash.retry} />;

  function details(item: TrashItem) {
    const dates = trashDates({ purgeAt: item.purgeAt });
    if (item.type === 'guest') {
      return t('trashPage.guest.details', { party: item.partyName, ...dates });
    }
    const guests = t('trashPage.guests', { count: item.guests });
    return t(`trashPage.${item.type}.details`, { guests, ...dates });
  }

  return (
    <div className="kore-trash">
      <Alert tone="warning" title={t('trashPage.warning')}>
        {t('trashPage.restoreInfo')}
      </Alert>
      {/* Vazia: o vazio tipo 1 da Voz, sem CTA (decisão 208). */}
      {trash.items.length === 0 && <EmptyState icon={<Trash2 />} title={t('trashPage.empty')} />}
      {trash.items.length > 0 && (
        <ul className="kore-trash__list">
          {trash.items.map((item) => (
            <li key={`${item.type}-${item.id}`} className="kore-trash__item">
              <span className="kore-trash__text">
                <span className="kore-trash__title" id={`trash-${item.id}`}>
                  {t(`trashPage.${item.type}.title`, { name: item.name })}
                </span>
                <span className="kore-trash__details">{details(item)}</span>
              </span>
              <Button
                variant="secondary"
                size="sm"
                aria-describedby={`trash-${item.id}`}
                disabled={trash.restoringId === item.id}
                onClick={() => trash.restore({ type: item.type, id: item.id })}
              >
                {t('trashPage.restore')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
