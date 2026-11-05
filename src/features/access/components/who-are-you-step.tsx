import { Button, Radio } from '@kore-io/design';
import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

export interface WhoAreYouValues {
  /** Qual dos dois nomes é a pessoa (contrato do aceite por link, RN14). */
  partnerIndex: 1 | 2;
  myTitle: 'bride' | 'groom';
}

export interface WhoAreYouStepProps {
  /** Os dois nomes do casal, na ordem do casamento. */
  partnerNames: [string, string];
  onSubmit: (values: WhoAreYouValues) => void;
  submitting?: boolean;
}

/**
 * Quem é você? (Área do Casal, Penpot; decisão 106): depois de aceitar o convite do casal
 * por link, a pessoa escolhe o próprio nome e se é noivo ou noiva. Continuar só habilita
 * com as duas escolhas.
 */
export function WhoAreYouStep({ partnerNames, onSubmit, submitting = false }: WhoAreYouStepProps) {
  const { t } = useTranslation('access');
  const titleId = useId();
  const [partnerIndex, setPartnerIndex] = useState<1 | 2>();
  const [myTitle, setMyTitle] = useState<'bride' | 'groom'>();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (partnerIndex && myTitle) onSubmit({ partnerIndex, myTitle });
  }

  return (
    <div className="kore-sign-in">
      <div className="kore-sign-in__heading">
        <h1 id={titleId} className="kore-sign-in__title">
          {t('whoAreYou.title')}
        </h1>
        <p className="kore-sign-in__description">{t('whoAreYou.description')}</p>
      </div>
      <form className="kore-sign-in__form" onSubmit={handleSubmit} noValidate>
        {/* O grupo dos nomes não tem rótulo no Penpot: o título da tela dá o nome. */}
        <div role="radiogroup" aria-labelledby={titleId} className="kore-wedding-details__options">
          {partnerNames.map((name, index) => (
            <Radio
              key={index}
              name="partnerIndex"
              value={index + 1}
              checked={partnerIndex === index + 1}
              onChange={() => setPartnerIndex(index === 0 ? 1 : 2)}
            >
              {name}
            </Radio>
          ))}
        </div>
        <fieldset className="kore-wedding-details__choice">
          <legend className="kore-wedding-details__legend">{t('weddingDetails.myTitle')}</legend>
          <div className="kore-wedding-details__options">
            <Radio
              name="myTitle"
              value="bride"
              checked={myTitle === 'bride'}
              onChange={() => setMyTitle('bride')}
            >
              {t('weddingDetails.bride')}
            </Radio>
            <Radio
              name="myTitle"
              value="groom"
              checked={myTitle === 'groom'}
              onChange={() => setMyTitle('groom')}
            >
              {t('weddingDetails.groom')}
            </Radio>
          </div>
        </fieldset>
        <Button
          type="submit"
          size="lg"
          className="kore-sign-in__submit"
          disabled={!partnerIndex || !myTitle || submitting}
        >
          {t('whoAreYou.submit')}
        </Button>
      </form>
    </div>
  );
}
