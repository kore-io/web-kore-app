import { Badge, Button, Dialog } from '@kore-io/design';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMeControllerMeV1 } from '../../../shared/api/generated/me/me';
import { useSignOutEverywhere } from '../../access/hooks/use-sign-out';

/** As formas de entrar que a tela conhece, na ordem do Penpot 15. */
const PROVIDERS = ['google', 'email'] as const;
type Provider = (typeof PROVIDERS)[number];

/**
 * As formas de entrar da conta, do `identities[]` do GET /v1/me (decisão 254(1)). O campo
 * chega com o PR curto da API; até o `api:sync`, a leitura é defensiva: sem o campo, a lista
 * fica vazia.
 */
function connectedProviders(me: unknown): Provider[] {
  const identities =
    typeof me === 'object' && me !== null && 'identities' in me && Array.isArray(me.identities)
      ? (me.identities as { provider?: unknown }[])
      : [];
  const providers = new Set(identities.map((identity) => identity.provider));
  return PROVIDERS.filter((provider) => providers.has(provider));
}

/**
 * Configurações › Acesso da cerimonialista (Cadastro e perfil RN11; Penpot 15):
 * - **Formas de entrar**: Google e E-mail com código, com o selo "Conectado";
 * - **Sair de todos os aparelhos**, com a confirmação da Voz (Login RN09).
 * Os Aparelhos conectados ficam fora da F6 (decisão 254(1)).
 */
export function PlannerAccessSettingsPage() {
  const { t } = useTranslation('planner');
  const me = useMeControllerMeV1();
  const { signOutEverywhere, pending } = useSignOutEverywhere();
  const [confirming, setConfirming] = useState(false);
  const openButton = useRef<HTMLButtonElement>(null);
  const providers = connectedProviders(me.data);

  return (
    <div className="kore-planner-access">
      {providers.length > 0 && (
        <section className="kore-planner-access__section" aria-labelledby="kore-sign-in-methods">
          <h2 id="kore-sign-in-methods" className="kore-planner-access__title">
            {t('settings.signInMethods')}
          </h2>
          <ul className="kore-planner-access__list">
            {providers.map((provider) => (
              <li key={provider} className="kore-planner-access__item">
                <span className="kore-planner-access__provider">
                  {t(`settings.providers.${provider}`)}
                </span>
                <Badge tone="success">{t('settings.connected')}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Button
        ref={openButton}
        type="button"
        variant="secondary"
        className="kore-planner-access__sign-out"
        onClick={() => setConfirming(true)}
      >
        {t('settings.signOutAll')}
      </Button>
      <Dialog
        open={confirming}
        onOpenChange={(open) => setConfirming(open)}
        role="alertdialog"
        title={t('settings.signOutAllTitle')}
        description={t('settings.signOutAllDescription')}
        returnFocusRef={openButton}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              {t('settings.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              aria-busy={pending || undefined}
              onClick={() => {
                // A confirmação fecha: no sucesso, a pessoa vai ao Entrar; na falha, o
                // aviso genérico aparece no Toast, fora do Dialog.
                setConfirming(false);
                signOutEverywhere();
              }}
            >
              {t('settings.signOutAllConfirm')}
            </Button>
          </>
        }
      />
    </div>
  );
}
