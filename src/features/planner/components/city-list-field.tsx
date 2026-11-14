import { Button, Input, Label, Select } from '@kore-io/design';
import { X } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BRAZIL_STATES } from '../../../shared/brazil-states';
import { addCityError, cityLabel } from '../planner-profile-form';

export interface CityListFieldProps {
  cities: readonly string[];
  onChange: (cities: string[]) => void;
  /** O erro da lista (ex.: "Adicione pelo menos uma cidade."), vindo do envio. */
  error?: string | undefined;
}

/**
 * Cidades de atuação (Cadastro e perfil RN04; decisão 249): Cidade e UF lado a lado com o
 * Adicionar, e as cidades em chips "Campinas (SP)" que se removem pelo x. Os erros da RN04
 * aparecem no campo; o Enter na Cidade também adiciona.
 */
export function CityListField({ cities, onChange, error }: CityListFieldProps) {
  const { t } = useTranslation('access');
  const cityId = useId();
  const stateId = useId();
  const hintId = useId();
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [addError, setAddError] = useState<string>();
  /** O campo do erro do Adicionar: a UF só no "Informe a UF."; o resto é da Cidade. */
  const [addErrorField, setAddErrorField] = useState<'city' | 'state'>('city');
  const shownError = addError ?? error;
  const stateInvalid = addError !== undefined && addErrorField === 'state';

  function add() {
    const problem = addCityError({ t, cities, city, state });
    if (problem) {
      setAddError(problem);
      setAddErrorField(city.trim() && !state ? 'state' : 'city');
      return;
    }
    onChange([...cities, cityLabel({ city, state })]);
    setCity('');
    setAddError(undefined);
  }

  return (
    <fieldset className="kore-city-list" aria-describedby={hintId}>
      <legend className="kore-city-list__legend">{t('plannerProfile.cities')}</legend>
      <div className="kore-city-list__inputs">
        <div className="kore-city-list__city">
          <Label htmlFor={cityId}>{t('plannerProfile.city')}</Label>
          <Input
            id={cityId}
            value={city}
            autoComplete="address-level2"
            invalid={shownError !== undefined && !stateInvalid}
            aria-describedby={hintId}
            onChange={(event) => {
              setCity(event.target.value);
              setAddError(undefined);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              add();
            }}
          />
        </div>
        <div className="kore-city-list__state">
          <Label htmlFor={stateId}>{t('plannerProfile.state')}</Label>
          <Select
            id={stateId}
            value={state}
            placeholder={t('weddingDetails.statePlaceholder')}
            invalid={stateInvalid}
            aria-describedby={hintId}
            onChange={(event) => {
              setState(event.target.value);
              setAddError(undefined);
            }}
          >
            {BRAZIL_STATES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </div>
        <Button type="button" variant="secondary" className="kore-city-list__add" onClick={add}>
          {t('plannerProfile.addCity')}
        </Button>
      </div>
      <p
        id={hintId}
        className={
          shownError ? 'kore-city-list__hint kore-city-list__hint--danger' : 'kore-city-list__hint'
        }
      >
        {shownError ?? t('plannerProfile.citiesHint')}
      </p>
      {cities.length > 0 && (
        <ul className="kore-city-list__chips">
          {cities.map((item) => (
            <li key={item} className="kore-city-list__chip">
              <span>{item}</span>
              <button
                type="button"
                className="kore-city-list__remove"
                aria-label={t('plannerProfile.removeCity', { city: item })}
                onClick={() => onChange(cities.filter((other) => other !== item))}
              >
                <X aria-hidden="true" className="kore-city-list__remove-icon" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
