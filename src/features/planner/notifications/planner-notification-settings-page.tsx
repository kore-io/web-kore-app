import { Alert, Select, Spinner, Switch, useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import {
  disablePush,
  enablePush,
  pushAvailability,
  type PushAvailability,
} from '../../notifications/push';
import { PLANNER_TYPES, type PlannerType } from './planner-notification-texts';

const EMAIL_OPTIONS: SavePreferenceBodyEmail[] = ['immediate', 'daily', 'off'];

type Reason = 'digest' | 'noPush' | 'centralOnly';

/**
 * O que cada tipo envia (RN06; decisões 274(4) e 300(3)): só Novas respostas escolhe o
 * e-mail e tem o push deste aparelho; os outros mostram o que vale, desabilitados com o
 * motivo, e a frase "Escolha como você quer receber cada aviso." segue verdadeira.
 */
const FIXED: Record<
  Exclude<PlannerType, 'rsvp'>,
  { email: SavePreferenceBodyEmail; emailReason: Reason; pushReason: Reason }
> = {
  wedding_published: { email: 'daily', emailReason: 'digest', pushReason: 'noPush' },
  membership_removed: { email: 'off', emailReason: 'centralOnly', pushReason: 'centralOnly' },
};

/**
 * Configurações › Notificações da cerimonialista (/cerimonialista/configuracoes/notificacoes;
 * RN06; decisão 300; Penpot 15): as preferências gerais (sem `weddingId`), uma linha por
 * tipo com Central, E-mail e Push. A central sempre recebe (Switch ligado e desabilitado).
 * Cada mudança grava na hora, com o Toast "Preferências salvas.". No desktop é uma tabela;
 * no celular, um cartão por tipo.
 */
export function PlannerNotificationSettingsPage() {
  const { t } = useTranslation('planner');
  const { t: tNotifications } = useTranslation('notifications');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const preferences = useNotificationsControllerGetPreferencesV1();
  const queryKey = getNotificationsControllerGetPreferencesV1QueryKey();
  const rsvp = preferences.data?.items.find((item) => item.type === 'rsvp');
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
        if (result === 'denied') {
          setAvailability('denied');
          return;
        }
      } else {
        await disablePush();
      }
      await queryClient.invalidateQueries({ queryKey });
      showToast({ tone: 'success', message: tNotifications('settings.saved') });
    } catch {
      failed();
    } finally {
      setPushBusy(false);
    }
  }

  async function saveEmail(email: SavePreferenceBodyEmail) {
    const before = queryClient.getQueryData<PreferencesResponse>(queryKey);
    queryClient.setQueryData<PreferencesResponse>(
      queryKey,
      (current) =>
        current && {
          ...current,
          items: current.items.map((item) => (item.type === 'rsvp' ? { ...item, email } : item)),
        },
    );
    try {
      // Sem `weddingId`: a preferência geral, para todos os casamentos dela (RN06).
      await notificationsControllerSavePreferenceV1({ type: 'rsvp', email });
      showToast({ tone: 'success', message: tNotifications('settings.saved') });
    } catch {
      queryClient.setQueryData(queryKey, before);
      failed();
    }
  }

  if (preferences.isError) {
    return <LoadErrorNotice onRetry={() => void preferences.refetch()} />;
  }
  if (!preferences.data || !rsvp) {
    return (
      <div className="kore-settings__loading">
        <Spinner label={tNotifications('settings.tab')} />
      </div>
    );
  }
  const push = preferences.data.push;
  const vapidPublicKey = push.vapidPublicKey ?? null;

  return (
    <div className="kore-planner-prefs">
      <p className="kore-planner-prefs__subtitle">{tNotifications('settings.subtitle')}</p>
      <div className="kore-planner-prefs__table">
        <div className="kore-planner-prefs__head" aria-hidden="true">
          <span className="kore-planner-prefs__col" />
          <span className="kore-planner-prefs__col--switch">
            {t('notificationSettings.central')}
          </span>
          <span className="kore-planner-prefs__col--email">{t('notificationSettings.email')}</span>
          <span className="kore-planner-prefs__col--push">{t('notificationSettings.push')}</span>
        </div>
        {PLANNER_TYPES.map((type) =>
          type === 'rsvp' ? (
            <PreferenceRow
              key={type}
              type={type}
              email={rsvp.email as SavePreferenceBodyEmail}
              onEmail={(email) => void saveEmail(email)}
              push={{
                checked: availability === 'ready' && push.subscribed === true,
                disabled: pushBusy || availability !== 'ready' || vapidPublicKey === null,
                reason: availability === 'denied' ? tNotifications('settings.pushDenied') : null,
                onChange: (on) => {
                  if (vapidPublicKey) void togglePush({ on, vapidPublicKey });
                },
              }}
            />
          ) : (
            <PreferenceRow
              key={type}
              type={type}
              email={FIXED[type].email}
              emailReason={t(`notificationSettings.reasons.${FIXED[type].emailReason}`)}
              push={{
                checked: false,
                disabled: true,
                reason: t(`notificationSettings.reasons.${FIXED[type].pushReason}`),
              }}
            />
          ),
        )}
      </div>
      {availability === 'install' && (
        <Alert tone="info">{tNotifications('settings.pushInstall')}</Alert>
      )}
    </div>
  );
}

/**
 * Uma linha (um cartão no celular): o tipo nomeia o grupo, e os rótulos Central, E-mail e
 * Push ficam visíveis no celular e só para o leitor de tela no desktop, onde o cabeçalho da
 * tabela os mostra. O motivo de cada controle desabilitado é a descrição dele; quando os
 * dois motivos são o mesmo, aparece uma vez só.
 */
function PreferenceRow({
  type,
  email,
  onEmail,
  emailReason,
  push,
}: {
  type: PlannerType;
  email: SavePreferenceBodyEmail;
  onEmail?: (email: SavePreferenceBodyEmail) => void;
  emailReason?: string;
  push: {
    checked: boolean;
    disabled: boolean;
    reason: string | null;
    onChange?: (on: boolean) => void;
  };
}) {
  const { t } = useTranslation('planner');
  const { t: tNotifications } = useTranslation('notifications');
  const id = useId();
  const nameId = `${id}-name`;
  const emailId = `${id}-email`;
  const emailReasonId = `${id}-email-reason`;
  const pushReasonId = push.reason === emailReason ? emailReasonId : `${id}-push-reason`;
  return (
    <div className="kore-planner-prefs__row" role="group" aria-labelledby={nameId}>
      <p id={nameId} className="kore-planner-prefs__type">
        {t(`notifications.types.${type}`)}
      </p>
      <div className="kore-planner-prefs__cell">
        <Switch checked disabled className="kore-planner-prefs__switch">
          <span className="kore-planner-prefs__label">{t('notificationSettings.central')}</span>
        </Switch>
      </div>
      <div className="kore-planner-prefs__cell kore-planner-prefs__cell--email">
        <label htmlFor={emailId} className="kore-planner-prefs__label">
          {t('notificationSettings.email')}
        </label>
        <div className="kore-planner-prefs__control">
          <Select
            id={emailId}
            value={email}
            disabled={!onEmail}
            {...(emailReason && { 'aria-describedby': emailReasonId })}
            onChange={(event) => onEmail?.(event.target.value as SavePreferenceBodyEmail)}
          >
            {EMAIL_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {tNotifications(`settings.emailOptions.${option}`)}
              </option>
            ))}
          </Select>
          {emailReason && (
            <p id={emailReasonId} className="kore-planner-prefs__reason">
              {emailReason}
            </p>
          )}
        </div>
      </div>
      <div className="kore-planner-prefs__cell kore-planner-prefs__cell--push">
        <div className="kore-planner-prefs__control">
          <Switch
            checked={push.checked}
            disabled={push.disabled}
            className="kore-planner-prefs__switch"
            {...(push.reason && { 'aria-describedby': pushReasonId })}
            onChange={(event) => push.onChange?.(event.target.checked)}
          >
            <span className="kore-planner-prefs__label">{t('notificationSettings.push')}</span>
          </Switch>
          {push.reason && pushReasonId !== emailReasonId && (
            <p id={pushReasonId} className="kore-planner-prefs__reason">
              {push.reason}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
