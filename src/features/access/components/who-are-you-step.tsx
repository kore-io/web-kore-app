import { Button, Radio } from '@kore-io/design';
import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { PartnerTitle } from '../api/access-invitations';

export interface WhoAreYouValues {
  /** Qual dos dois nomes é a pessoa; sem os nomes (convite do parceiro), não vem. */
  partnerIndex?: 1 | 2;
  myTitle: PartnerTitle;
}

export interface WhoAreYouStepProps {
  /**
   * Os dois nomes do casal, na ordem do casamento (convite do casal, decisões 172(1) e 173).
   * Sem eles, só o título (convite do parceiro com o título nulo, decisões 172(2) e 174(5)).
   */
  partnerNames?: [string, string];
  onSubmit: (values: WhoAreYouValues) => void;
  submitting?: boolean;
}

/**
 * Quem é você? (Área do Casal, Penpot; decisão 106): no aceite do convite do casal, a pessoa
 * escolhe o próprio nome e se é noivo ou noiva; no do parceiro sem título, só "Você é o noivo
 * ou a noiva?". Continuar só habilita com as escolhas.
 */
export function WhoAreYouStep({ partnerNames, onSubmit, submitting = false }: WhoAreYouStepProps) {
  const { t } = useTranslation('access');
  const titleId = useId();
  const [partnerIndex, setPartnerIndex] = useState<1 | 2>();
  const [myTitle, setMyTitle] = useState<PartnerTitle>();
  const withNames = partnerNames !== undefined;
  const ready = myTitle !== undefined && (!withNames || partnerIndex !== undefined);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!myTitle || (withNames && !partnerIndex)) return;
    onSubmit({ myTitle, ...(partnerIndex !== undefined && { partnerIndex }) });
  }

  const titleOptions = (
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
  );

  return (
    <div className="kore-sign-in">
      <div className="kore-sign-in__heading">
        <h1 id={titleId} className="kore-sign-in__title">
          {withNames ? t('whoAreYou.title') : t('weddingDetails.myTitle')}
        </h1>
        {withNames && <p className="kore-sign-in__description">{t('whoAreYou.description')}</p>}
      </div>
      <form className="kore-sign-in__form" onSubmit={handleSubmit} noValidate>
        {withNames ? (
          <>
            {/* O grupo dos nomes não tem rótulo no Penpot: o título da tela dá o nome. */}
            <div
              role="radiogroup"
              aria-labelledby={titleId}
              className="kore-wedding-details__options"
            >
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
              <legend className="kore-wedding-details__legend">
                {t('weddingDetails.myTitle')}
              </legend>
              {titleOptions}
            </fieldset>
          </>
        ) : (
          // Só o título: o título da tela é a pergunta e dá o nome ao grupo.
          <div role="radiogroup" aria-labelledby={titleId}>
            {titleOptions}
          </div>
        )}
        <Button
          type="submit"
          size="lg"
          className="kore-sign-in__submit"
          disabled={!ready || submitting}
        >
          {t('whoAreYou.submit')}
        </Button>
      </form>
    </div>
  );
}
