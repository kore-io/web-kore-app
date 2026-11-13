import { Button } from '@kore-io/design';
import { CreditCard, Globe, LayoutDashboard } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/** Os 3 benefícios do Início, sem o percentual da comissão (RN06; Penpot A1). */
const BENEFITS = [
  { key: 'panel', Icon: LayoutDashboard },
  { key: 'site', Icon: Globe },
  { key: 'commission', Icon: CreditCard },
] as const;

/**
 * Cadastro — Início (Penpot "Início — sem o percentual" e "com sessão"): o título, o apoio e os
 * benefícios; abaixo, o login (sem sessão) ou a conta e o Continuar (com sessão, A5).
 */
export function PlannerStartStep({
  notice,
  children,
}: {
  notice?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation('access');
  return (
    <div className="kore-sign-in">
      {notice}
      <div className="kore-sign-in__heading">
        <h1 className="kore-sign-in__title">{t('plannerSignUp.title')}</h1>
        <p className="kore-sign-in__description">{t('plannerSignUp.description')}</p>
      </div>
      <ul className="kore-planner-benefits">
        {BENEFITS.map(({ key, Icon }) => (
          <li key={key} className="kore-planner-benefits__item">
            <span className="kore-planner-benefits__icon" aria-hidden="true">
              <Icon strokeWidth={1.75} />
            </span>
            <span className="kore-planner-benefits__text">
              <span className="kore-planner-benefits__title">
                {t(`plannerSignUp.benefits.${key}.title`)}
              </span>
              <span className="kore-planner-benefits__description">
                {t(`plannerSignUp.benefits.${key}.description`)}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {children}
    </div>
  );
}

/** Com sessão (A5): "Você vai usar a conta {e-mail}." e o Continuar, sem os botões de login. */
export function PlannerAccountContinue({
  email,
  onContinue,
}: {
  email: string;
  onContinue: () => void;
}) {
  const { t } = useTranslation('access');
  return (
    <div className="kore-planner-account">
      <p className="kore-planner-account__text">{t('plannerSignUp.account', { email })}</p>
      <Button type="button" size="lg" className="kore-sign-in__submit" onClick={onContinue}>
        {t('plannerSignUp.submit')}
      </Button>
    </div>
  );
}

/** Link de indicação pronto (RN06; Penpot "Link de indicação — sem o percentual"). */
export function PlannerReferralReadyStep({
  link,
  discountPercent,
  onCopy,
  onContinue,
}: {
  /** O link completo, do GET /v1/me/referrer. */
  link: string;
  /** Nulo com o desconto desligado: sem a 2ª frase (decisão 250(b)). */
  discountPercent: number | null;
  onCopy: () => void;
  onContinue: () => void;
}) {
  const { t } = useTranslation('access');
  const message =
    discountPercent === null
      ? t('plannerSignUp.ready.whatsappMessage', { link })
      : t('plannerSignUp.ready.whatsappMessageDiscount', { link, percent: discountPercent });
  return (
    <div className="kore-sign-in">
      <div className="kore-sign-in__heading">
        <h1 className="kore-sign-in__title">{t('plannerSignUp.ready.title')}</h1>
        <p className="kore-sign-in__description">
          {discountPercent === null
            ? t('plannerSignUp.ready.description')
            : t('plannerSignUp.ready.descriptionDiscount', { percent: discountPercent })}
        </p>
      </div>
      <p className="kore-planner-ready__link">{link.replace(/^https?:\/\//, '')}</p>
      <div className="kore-planner-ready__actions">
        <Button
          type="button"
          size="lg"
          onClick={() =>
            window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener')
          }
        >
          {t('plannerSignUp.ready.whatsapp')}
        </Button>
        <Button type="button" variant="secondary" size="lg" onClick={onCopy}>
          {t('plannerSignUp.ready.copy')}
        </Button>
      </div>
      <p className="kore-planner-ready__note">{t('plannerSignUp.ready.note')}</p>
      <Button
        type="button"
        variant="ghost"
        size="lg"
        className="kore-sign-in__submit"
        onClick={onContinue}
      >
        {t('plannerSignUp.ready.continue')}
      </Button>
    </div>
  );
}

const STEPS = ['bring', 'publish', 'commission'] as const;

/** Como funciona (RN06; Penpot "Como funciona — sem o percentual"). */
export function PlannerHowItWorksStep({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation('access');
  return (
    <div className="kore-sign-in">
      <div className="kore-sign-in__heading">
        <h1 className="kore-sign-in__title">{t('plannerSignUp.howItWorks.title')}</h1>
        <p className="kore-sign-in__description">{t('plannerSignUp.howItWorks.description')}</p>
      </div>
      <ol className="kore-planner-steps">
        {STEPS.map((key, index) => (
          <li key={key} className="kore-planner-steps__item">
            <span className="kore-planner-steps__number" aria-hidden="true">
              {index + 1}
            </span>
            <span className="kore-planner-steps__text">
              <span className="kore-planner-steps__title">
                {t(`plannerSignUp.howItWorks.steps.${key}.title`)}
              </span>
              <span className="kore-planner-steps__description">
                {t(`plannerSignUp.howItWorks.steps.${key}.description`)}
              </span>
            </span>
          </li>
        ))}
      </ol>
      <Button type="button" size="lg" className="kore-sign-in__submit" onClick={onDone}>
        {t('plannerSignUp.howItWorks.goToWeddings')}
      </Button>
    </div>
  );
}

/** Cadastro fechado (RN02; Penpot A6): o título, o texto e o Voltar ao Kore. */
export function PlannerSignUpClosed({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation('access');
  return (
    <div className="kore-sign-in">
      <div className="kore-sign-in__heading">
        <h1 className="kore-sign-in__title">{t('plannerSignUp.closed.title')}</h1>
        <p className="kore-sign-in__description">{t('plannerSignUp.closed.description')}</p>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        className="kore-sign-in__submit"
        onClick={onBack}
      >
        {t('plannerSignUp.closed.back')}
      </Button>
    </div>
  );
}
