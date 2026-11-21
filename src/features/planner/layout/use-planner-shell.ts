import type { UserMenuItem } from '@kore-io/design';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { paths } from '../../../app/paths';
import type { MeResponse } from '../../../shared/api/generated/model';
import { useNotificationsControllerUnreadV1 } from '../../../shared/api/generated/notifications/notifications';
import { useSignOut } from '../../access/hooks/use-sign-out';
import { menuUser } from '../../access/session-user';

/**
 * A parte da Topbar que é a mesma na Área do cerimonialista e dentro do casamento
 * (Colaboradora RN02): a pessoa, "Cerimonialista · {assessoria}", o menu (Meu perfil,
 * Configurações, Trocar de perfil ou Criar outro perfil, Sair; RN08) e o sino dela, com as
 * não lidas de todos os casamentos dela (`scope=planner`; Notificações da cerimonialista RN05
 * e RN08), lido ao abrir, ao voltar à aba e a cada 60 s com a aba visível, como o do casal.
 */
export function usePlannerShell({ me }: { me: MeResponse | undefined }) {
  const { t } = useTranslation('planner');
  const signOut = useSignOut();
  const navigate = useNavigate();
  const unread = useNotificationsControllerUnreadV1(
    { scope: 'planner' },
    {
      query: {
        enabled: Boolean(me?.planner),
        refetchInterval: 60_000,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: true,
      },
    },
  );
  const organization = me?.planner?.organization ?? '';
  const couple = me?.memberships.find((membership) => membership.role === 'owner')?.weddingName;
  const profiles = me?.profiles ?? [];
  // Trocar de perfil com mais de um perfil; Criar outro perfil quando falta o de casal e a
  // conta não é de vendas (RN08; decisão 85): a cerimonialista cria o casal pelo /cadastro.
  const profileItems: UserMenuItem[] = [
    ...(profiles.length > 1
      ? [
          {
            id: 'switch-profile',
            label: t('menu.switchProfile'),
            ...(couple && { detail: t('menu.switchProfileCouple', { couple }) }),
            onSelect: () => void navigate(paths.profiles),
          },
        ]
      : []),
    ...(me && !profiles.includes('couple') && !profiles.includes('seller')
      ? [
          {
            id: 'create-profile',
            label: t('menu.createProfile'),
            detail: t('menu.createProfileCouple'),
            onSelect: () => void navigate(paths.signUp),
          },
        ]
      : []),
  ];
  return {
    organization,
    user: me ? menuUser({ user: me.user }) : { name: '', email: '', initials: '' },
    activeProfile: t('menu.activeProfile', { organization }),
    userMenuGroups: [
      [
        {
          id: 'profile',
          label: t('menu.profile'),
          onSelect: () => void navigate(paths.plannerProfile),
        },
        {
          id: 'settings',
          label: t('menu.settings'),
          onSelect: () => void navigate(paths.plannerSettings),
        },
        ...profileItems,
      ],
      [{ id: 'sign-out', label: t('menu.signOut'), onSelect: signOut }],
    ],
    notifications: {
      unread: unread.data?.unreadCount ?? 0,
      onOpen: () => void navigate(paths.plannerNotifications),
    },
  };
}
