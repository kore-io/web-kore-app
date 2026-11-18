import { Button, EmptyState, PageHeader, Spinner, useToast } from '@kore-io/design';
import { ChevronRight, Link as LinkIcon, Users } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { paths } from '../../../app/paths';
import { usePlannerControllerReferrerV1 } from '../../../shared/api/generated/me/me';
import type { ReferredWeddingResponse } from '../../../shared/api/generated/model';
import { useReferredWeddingsControllerListV1 } from '../../../shared/api/generated/planner/planner';
import { LoadErrorNotice } from '../../../shared/components/load-error';
import { coupleName } from '../my-weddings/my-weddings-filters';
import { WeddingStatusBadge } from '../my-weddings/wedding-status-badge';

/** O detalhe do casamento, o mesmo de Meus casamentos (RN05; decisão 260(1)). */
const weddingPath = (weddingId: string) =>
  `${paths.plannerArea}?casamento=${encodeURIComponent(weddingId)}`;

/**
 * A linha abre o detalhe só quando ela colabora no casamento (RN05). O `clickable` ainda não
 * está no contrato; enquanto isso, vale o `weddingId`, que vem nulo sem vínculo (decisão 288).
 */
function detailId(wedding: ReferredWeddingResponse): string | null {
  const { clickable } = wedding as ReferredWeddingResponse & { clickable?: boolean };
  return (clickable ?? wedding.weddingId !== null) ? wedding.weddingId : null;
}

/**
 * Link de indicação (`/cerimonialista/link-de-indicacao`; Link de indicação RN01 a RN06; Penpot
 * 09, "sem o percentual"): o link com Copiar e Compartilhar no WhatsApp, e os casais que se
 * cadastraram por ele. A coluna Comissão fica para o front de Comissões da F3 (decisão 288).
 */
export function ReferralLinkPage() {
  const { t } = useTranslation('planner');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const listTitleId = useId();
  const referrer = usePlannerControllerReferrerV1();
  const weddings = useReferredWeddingsControllerListV1();

  if (referrer.isError || weddings.isError) {
    return (
      <div className="kore-referral-link">
        <PageHeader title={t('referral.title')} />
        <LoadErrorNotice
          onRetry={() => {
            if (referrer.isError) void referrer.refetch();
            if (weddings.isError) void weddings.refetch();
          }}
        />
      </div>
    );
  }
  if (!referrer.data || !weddings.data) {
    return (
      <div className="kore-referral-link">
        <PageHeader title={t('referral.title')} />
        <div className="kore-referral-link__loading">
          <Spinner label={t('referral.loading')} />
        </div>
      </div>
    );
  }

  const { link, discountPercent } = referrer.data;
  // Com o desconto desligado, sem o subtítulo (decisão 250(b)); a mensagem é a sem desconto.
  const message =
    discountPercent === null
      ? tAccess('plannerSignUp.ready.whatsappMessage', { link })
      : tAccess('plannerSignUp.ready.whatsappMessageDiscount', { link, percent: discountPercent });
  const share = () =>
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
  const copy = () =>
    void navigator.clipboard
      .writeText(link)
      .then(() => showToast({ tone: 'success', message: t('referral.copied') }))
      // Sem a área de transferência (permissão negada): o aviso genérico; o link segue na tela.
      .catch(() =>
        showToast({
          tone: 'danger',
          message: `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
        }),
      );

  return (
    <div className="kore-referral-link">
      <PageHeader
        title={t('referral.title')}
        {...(discountPercent !== null && {
          description: t('referral.descriptionDiscount', { percent: discountPercent }),
        })}
      />
      <section className="kore-referral-link__card">
        <p className="kore-referral-link__link">
          <LinkIcon aria-hidden="true" className="kore-referral-link__link-icon" />
          <span className="kore-referral-link__link-text">{link.replace(/^https?:\/\//, '')}</span>
        </p>
        <div className="kore-referral-link__actions">
          <Button type="button" variant="secondary" onClick={copy}>
            {t('referral.copy')}
          </Button>
          <Button type="button" onClick={share}>
            {t('referral.whatsapp')}
          </Button>
        </div>
      </section>
      <section className="kore-referral-link__list" aria-labelledby={listTitleId}>
        <h2 id={listTitleId} className="kore-referral-link__list-title">
          {t('referral.listTitle')}
        </h2>
        {weddings.data.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title={t('referral.empty.title')}
            description={t('referral.empty.description')}
            action={
              <Button type="button" onClick={share}>
                {t('referral.whatsapp')}
              </Button>
            }
          />
        ) : (
          <ReferredWeddings weddings={weddings.data} />
        )}
      </section>
    </div>
  );
}

/**
 * Casal · Status (RN03): a tabela no desktop e os cartões no tablet e no celular, na ordem do
 * servidor (do cadastro mais recente). Só a linha de quem colabora abre o detalhe (RN05).
 */
function ReferredWeddings({ weddings }: { weddings: readonly ReferredWeddingResponse[] }) {
  const { t } = useTranslation('planner');
  const navigate = useNavigate();
  return (
    <>
      <table className="kore-referral-link__table">
        <thead>
          <tr>
            <th scope="col">{t('referral.columns.couple')}</th>
            <th scope="col">{t('referral.columns.status')}</th>
            <td aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {weddings.map((wedding, index) => {
            const id = detailId(wedding);
            return (
              <tr
                key={wedding.weddingId ?? `row-${index}`}
                {...(id !== null && {
                  className: 'kore-referral-link__row--link',
                  onClick: () => void navigate(weddingPath(id)),
                })}
              >
                <th scope="row">
                  {id !== null ? (
                    <Link
                      className="kore-referral-link__couple"
                      to={weddingPath(id)}
                      // O clique na linha já navega; o do link não repete.
                      onClick={(event) => event.stopPropagation()}
                    >
                      {coupleName(wedding)}
                    </Link>
                  ) : (
                    coupleName(wedding)
                  )}
                </th>
                <td>
                  <WeddingStatusBadge status={wedding.status} />
                </td>
                <td className="kore-referral-link__chevron-cell">
                  {id !== null && (
                    <ChevronRight aria-hidden="true" className="kore-referral-link__chevron" />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ul className="kore-referral-link__cards">
        {weddings.map((wedding, index) => {
          const id = detailId(wedding);
          const body = (
            <>
              <span className="kore-referral-link__card-couple">{coupleName(wedding)}</span>
              <span className="kore-referral-link__card-end">
                <WeddingStatusBadge status={wedding.status} />
                {id !== null && (
                  <ChevronRight aria-hidden="true" className="kore-referral-link__chevron" />
                )}
              </span>
            </>
          );
          return (
            <li key={wedding.weddingId ?? `card-${index}`}>
              {id !== null ? (
                <Link className="kore-referral-link__item" to={weddingPath(id)}>
                  {body}
                </Link>
              ) : (
                <div className="kore-referral-link__item">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
