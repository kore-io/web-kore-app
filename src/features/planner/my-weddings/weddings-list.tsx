import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import type { MyWeddingItemResponse } from '../../../shared/api/generated/model';
import { coupleName, shortDate } from './my-weddings-filters';
import { WeddingStatusBadge } from './wedding-status-badge';

/**
 * A lista de Meus casamentos (RN02; Penpot 03): a tabela Casal · Data · Status · Respostas ·
 * Origem do tablet em diante, e os cartões no celular. A linha inteira leva ao casamento; o
 * nome do casal é o link, para o teclado e o leitor de tela.
 */
export function WeddingsList({
  weddings,
  weddingPath,
}: {
  weddings: readonly MyWeddingItemResponse[];
  weddingPath: (weddingId: string) => string;
}) {
  const { t } = useTranslation('planner');
  const navigate = useNavigate();
  const date = (wedding: MyWeddingItemResponse) =>
    wedding.eventDate ? shortDate({ date: wedding.eventDate }) : t('myWeddings.noDate');
  // Sem convidados, "—" (RN02).
  const responses = (wedding: MyWeddingItemResponse) =>
    wedding.guestsTotal > 0 ? `${wedding.rsvpPercent}%` : '—';

  return (
    <>
      <table className="kore-my-weddings__table">
        <thead>
          <tr>
            <th scope="col">{t('myWeddings.columns.couple')}</th>
            <th scope="col">{t('myWeddings.columns.date')}</th>
            <th scope="col">{t('myWeddings.columns.status')}</th>
            <th scope="col">{t('myWeddings.columns.responses')}</th>
            <th scope="col">{t('myWeddings.columns.origin')}</th>
            <td aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {weddings.map((wedding) => (
            <tr
              key={wedding.weddingId}
              className="kore-my-weddings__row"
              onClick={() => void navigate(weddingPath(wedding.weddingId))}
            >
              <th scope="row">
                <Link
                  className="kore-my-weddings__couple"
                  to={weddingPath(wedding.weddingId)}
                  // O clique na linha já navega; o do link não repete.
                  onClick={(event) => event.stopPropagation()}
                >
                  {coupleName(wedding)}
                </Link>
              </th>
              <td>{date(wedding)}</td>
              <td>
                <WeddingStatusBadge status={wedding.status} />
              </td>
              <td>{responses(wedding)}</td>
              <td>{t(`myWeddings.origin.${wedding.origin}`)}</td>
              <td className="kore-my-weddings__chevron-cell">
                <ChevronRight aria-hidden="true" className="kore-my-weddings__chevron" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="kore-my-weddings__cards">
        {weddings.map((wedding) => (
          <li key={wedding.weddingId}>
            <Link className="kore-my-weddings__card" to={weddingPath(wedding.weddingId)}>
              <span className="kore-my-weddings__card-body">
                <span className="kore-my-weddings__card-couple">{coupleName(wedding)}</span>
                <span className="kore-my-weddings__card-meta">
                  {date(wedding)} · {wedding.city} ({wedding.state})
                </span>
                <span className="kore-my-weddings__card-status">
                  <WeddingStatusBadge status={wedding.status} />
                  {wedding.guestsTotal > 0 && (
                    <span>{t('myWeddings.responses', { percent: wedding.rsvpPercent })}</span>
                  )}
                </span>
                <span className="kore-my-weddings__card-origin">
                  {t(`myWeddings.origin.${wedding.origin}`)}
                </span>
              </span>
              <ChevronRight aria-hidden="true" className="kore-my-weddings__chevron" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
