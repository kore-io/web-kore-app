import { Alert } from '@kore-io/design';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { MyWeddingsAlertsResponse } from '../../../shared/api/generated/model';
import { coupleName } from './my-weddings-filters';

/** Até 5 nomes; depois, "e mais {N}" (RN07). */
const SHOWN = 5;

interface AlertWedding {
  weddingId: string;
  partnerNames: string[];
  /** O prazo de resposta ou a data do casamento, para a ordem (o mais próximo primeiro). */
  date: string;
}

/**
 * O bloco de alertas no topo de Meus casamentos (RN05 a RN07; Penpot 03, A3): um Alert
 * Atenção por regra, só com pelo menos 1 casamento. "Ver casamentos" abre a lista com os
 * nomes do casal (sem número nem convidado), cada um com o link ao casamento.
 */
export function WeddingsAlerts({
  alerts,
  weddingPath,
}: {
  alerts: MyWeddingsAlertsResponse;
  weddingPath: (weddingId: string) => string;
}) {
  const { t } = useTranslation('planner');
  const pending = alerts.pendingResponses.map((item) => ({ ...item, date: item.rsvpDeadline }));
  const notSent = alerts.invitationsNotSent.map((item) => ({ ...item, date: item.eventDate }));
  if (pending.length === 0 && notSent.length === 0) return null;
  return (
    <div className="kore-my-weddings__alerts">
      {pending.length > 0 && (
        <WeddingsAlert
          text={t('myWeddings.alerts.pendingResponses', { count: pending.length })}
          weddings={pending}
          weddingPath={weddingPath}
        />
      )}
      {notSent.length > 0 && (
        <WeddingsAlert
          text={t('myWeddings.alerts.invitationsNotSent', { count: notSent.length })}
          weddings={notSent}
          weddingPath={weddingPath}
        />
      )}
    </div>
  );
}

function WeddingsAlert({
  text,
  weddings,
  weddingPath,
}: {
  text: string;
  weddings: AlertWedding[];
  weddingPath: (weddingId: string) => string;
}) {
  const { t } = useTranslation('planner');
  const [open, setOpen] = useState(false);
  const listId = useId();
  const sorted = [...weddings].sort((a, b) => a.date.localeCompare(b.date));
  const shown = sorted.slice(0, SHOWN);
  const more = sorted.length - shown.length;
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <Alert tone="warning">
      <p className="kore-my-weddings__alert-text">{text}</p>
      {open && (
        <ul id={listId} className="kore-my-weddings__alert-list">
          {shown.map((wedding) => (
            <li key={wedding.weddingId}>
              <Link className="kore-my-weddings__alert-link" to={weddingPath(wedding.weddingId)}>
                {coupleName(wedding)}
              </Link>
            </li>
          ))}
          {more > 0 && <li>{t('myWeddings.alerts.more', { count: more })}</li>}
        </ul>
      )}
      <button
        type="button"
        className="kore-my-weddings__alert-toggle"
        aria-expanded={open}
        {...(open && { 'aria-controls': listId })}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? t('myWeddings.alerts.hide') : t('myWeddings.alerts.show')}
        <Chevron aria-hidden="true" className="kore-my-weddings__alert-chevron" />
      </button>
    </Alert>
  );
}
