import { PageHeader, Select, Spinner, Switch, Tab, Tabs, useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useMeControllerMeV1 } from '../../../shared/api/generated/me/me';
import type {
  PreferencesResponse,
  SavePreferenceBodyEmail,
} from '../../../shared/api/generated/model';
import {
  getNotificationsControllerGetPreferencesV1QueryKey,
  notificationsControllerSavePreferenceV1,
  useNotificationsControllerGetPreferencesV1,
} from '../../../shared/api/generated/notifications/notifications';
import { LoadErrorNotice } from '../../../shared/components/load-error';
import { useActiveWedding } from '../../guests/hooks/use-active-wedding';
import { disablePush, enablePush, pushAvailability, type PushAvailability } from '../push';
import { useAreaPaths } from '../../../app/area';

const EMAIL_OPTIONS: SavePreferenceBodyEmail[] = ['immediate', 'daily', 'off'];

/**
 * Configurações › Notificações (/app/configuracoes/notificacoes; Central RN07; decisão 221;
 * Penpot 27): por pessoa e por casamento, a linha Respostas do convite com o E-mail (Na
 * hora · Resumo diário às 20h · Desligado, padrão o resumo). Cada mudança grava na hora,
 * sem botão Salvar, com o Toast "Preferências salvas.". A central sempre recebe tudo. O
 * Push vale para este aparelho (Notificações e push RN07): ligar pede a permissão e assina;
 * desligar apaga a assinatura deste aparelho. Na F5, das abas só existe Notificações.
 */
export function NotificationSettingsPage() {
  const { weddingId } = useActiveWedding();
  if (!weddingId) return null;
  return <NotificationSettings weddingId={weddingId} />;
}

function NotificationSettings({ weddingId }: { weddingId: string }) {
  const area = useAreaPaths();
  const { t } = useTranslation('notifications');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const emailId = useId();
  const { data: me } = useMeControllerMeV1();
  const params = { weddingId };
  const preferences = useNotificationsControllerGetPreferencesV1(params);
  const rsvp = preferences.data?.items.find((item) => item.type === 'rsvp');
  const queryKey = getNotificationsControllerGetPreferencesV1QueryKey(params);
  const [availability, setAvailability] = useState<PushAvailability>(() => pushAvailability());
  const [pushBusy, setPushBusy] = useState(false);
  const failed = () =>
    showToast({
      tone: 'danger',
      message: `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
    });

  async function togglePush({ on, vapidPublicKey }: { on: boolean; vapidPublicKey: string }) {
    setPushBusy(true);
    try {
      if (on) {
        const result = await enablePush({ vapidPublicKey });
        // Não aceitou: o switch fica desligado, com o aviso do navegador.
        if (result === 'denied') {
          setAvailability('denied');
          return;
        }
      } else {
        await disablePush();
      }
      await queryClient.invalidateQueries({ queryKey });
      showToast({ tone: 'success', message: t('settings.saved') });
    } catch {
      failed();
    } finally {
      setPushBusy(false);
    }
  }

  async function saveEmail(email: SavePreferenceBodyEmail) {
    const before = queryClient.getQueryData<PreferencesResponse>(queryKey);
    // Na hora, na tela; se a gravação falhar, volta ao que estava.
    queryClient.setQueryData<PreferencesResponse>(
      queryKey,
      (current) =>
        current && {
          ...current,
          items: current.items.map((item) => (item.type === 'rsvp' ? { ...item, email } : item)),
        },
    );
    try {
      await notificationsControllerSavePreferenceV1({ weddingId, type: 'rsvp', email });
      showToast({ tone: 'success', message: t('settings.saved') });
    } catch {
      queryClient.setQueryData(queryKey, before);
      failed();
    }
  }

  const description = me ? [me.user.name, me.user.email].filter(Boolean).join(' · ') : undefined;

  return (
    <div className="kore-settings">
      <PageHeader title={t('settings.title')} description={description} />
      <Tabs aria-label={t('settings.tabs')}>
        <Tab asChild current>
          <Link to={area.settingsNotifications}>{t('settings.tab')}</Link>
        </Tab>
      </Tabs>
      {preferences.isError ? (
        <LoadErrorNotice onRetry={() => void preferences.refetch()} />
      ) : !rsvp ? (
        <div className="kore-settings__loading">
          <Spinner label={t('settings.tab')} />
        </div>
      ) : (
        <section className="kore-settings__panel" aria-labelledby="kore-settings-section">
          <h2 id="kore-settings-section" className="kore-settings__section">
            {t('settings.section')}
          </h2>
          <p className="kore-settings__subtitle">{t('settings.subtitle')}</p>
          <div className="kore-settings__row">
            <p className="kore-settings__type">{t('settings.rsvp')}</p>
            <div className="kore-settings__field">
              <label htmlFor={emailId} className="kore-settings__label">
                {t('settings.email')}
              </label>
              <Select
                id={emailId}
                value={rsvp.email}
                onChange={(event) => void saveEmail(event.target.value as SavePreferenceBodyEmail)}
              >
                {EMAIL_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {t(`settings.emailOptions.${option}`)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <PushRow
            push={preferences.data?.push}
            availability={availability}
            busy={pushBusy}
            onToggle={(on, vapidPublicKey) => void togglePush({ on, vapidPublicKey })}
          />
          <p className="kore-settings__note">{t('settings.note')}</p>
        </section>
      )}
    </div>
  );
}

/**
 * A linha do Push (Penpot 27): o switch vale para este aparelho. Sem o app instalado (ou
 * sem push no navegador), desabilitado com "Para receber push, instale o Kore no seu
 * celular."; bloqueado no navegador, com o aviso de liberar; sem a chave VAPID no ambiente,
 * só desabilitado.
 */
function PushRow({
  push,
  availability,
  busy,
  onToggle,
}: {
  push: PreferencesResponse['push'] | undefined;
  availability: PushAvailability;
  busy: boolean;
  onToggle: (on: boolean, vapidPublicKey: string) => void;
}) {
  const { t } = useTranslation('notifications');
  const vapidPublicKey = push?.vapidPublicKey ?? null;
  const reason =
    availability === 'install'
      ? t('settings.pushInstall')
      : availability === 'denied'
        ? t('settings.pushDenied')
        : null;
  return (
    <div className="kore-settings__push">
      <Switch
        checked={availability === 'ready' && push?.subscribed === true}
        disabled={busy || availability !== 'ready' || vapidPublicKey === null}
        {...(reason && { 'aria-describedby': 'kore-settings-push-reason' })}
        onChange={(event) => {
          if (vapidPublicKey) onToggle(event.target.checked, vapidPublicKey);
        }}
      >
        {t('settings.push')}
      </Switch>
      {reason && (
        <p id="kore-settings-push-reason" className="kore-settings__push-reason">
          {reason}
        </p>
      )}
    </div>
  );
}
