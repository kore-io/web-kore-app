import { PageHeader, Select, Spinner, Tab, Tabs, useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { paths } from '../../../app/paths';
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

const EMAIL_OPTIONS: SavePreferenceBodyEmail[] = ['immediate', 'daily', 'off'];

/**
 * Configurações › Notificações (/app/configuracoes/notificacoes; Central RN07; decisão 221;
 * Penpot 27): por pessoa e por casamento, a linha Respostas do convite com o E-mail (Na
 * hora · Resumo diário às 20h · Desligado, padrão o resumo). Cada mudança grava na hora,
 * sem botão Salvar, com o Toast "Preferências salvas.". A central sempre recebe tudo; o
 * push por aparelho entra no C9. Na F5, das abas de Configurações só existe Notificações.
 */
export function NotificationSettingsPage() {
  const { weddingId } = useActiveWedding();
  if (!weddingId) return null;
  return <NotificationSettings weddingId={weddingId} />;
}

function NotificationSettings({ weddingId }: { weddingId: string }) {
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
      showToast({
        tone: 'danger',
        message: `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
      });
    }
  }

  const description = me ? [me.user.name, me.user.email].filter(Boolean).join(' · ') : undefined;

  return (
    <div className="kore-settings">
      <PageHeader title={t('settings.title')} description={description} />
      <Tabs aria-label={t('settings.tabs')}>
        <Tab asChild current>
          <Link to={paths.settingsNotifications}>{t('settings.tab')}</Link>
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
          <p className="kore-settings__note">{t('settings.note')}</p>
        </section>
      )}
    </div>
  );
}
