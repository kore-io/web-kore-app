import type { UserMenuItem } from '@kore-io/design';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { paths } from '../../../app/paths';
import type { MeResponse } from '../../../shared/api/generated/model';
import { useSignOut } from '../../access/hooks/use-sign-out';
import { menuUser } from '../../access/session-user';

/**
 * A parte da Topbar que é a mesma na Área do cerimonialista e dentro do casamento
 * (Colaboradora RN02): a pessoa, "Cerimonialista · {assessoria}", o menu (Meu perfil,
 * Configurações, Trocar de perfil ou Criar outro perfil, Sair; RN08) e o sino dela, sem
 * contador até o D9 (decisão 254(2)).
 */
export function usePlannerShell({ me }: { me: MeResponse | undefined }) {
  const { t } = useTranslation('planner');
  const signOut = useSignOut();
  const navigate = useNavigate();
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
    notifications: { unread: 0, onOpen: () => void navigate(paths.plannerNotifications) },
  };
}
