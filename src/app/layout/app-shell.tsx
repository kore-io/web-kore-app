import {
  IconButton,
  Logo,
  Sidebar,
  SidebarDrawer,
  Topbar,
  UserMenu,
  type UserMenuItem,
} from '@kore-io/design';
import { Bell } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface AppShellProps {
  /** Título da Topbar (ex.: os nomes do casal). */
  title: ReactNode;
  user: { name: string; email: string; initials: string };
  activeProfile?: string;
  userMenuGroups: UserMenuItem[][];
  /** Os Nav Items da área (a Sidebar mostra só o que existe na fase). */
  navigation: ReactNode;
  /** Selo de status ao lado do título (ex.: o do site); sai no celular, como no DS. */
  status?: ReactNode;
  /** Sino de notificações, quando a área tiver: número de não lidas e a ação. */
  notifications?: { unread: number; onOpen: () => void };
  children: ReactNode;
}

/**
 * Layout base do app (DS v0.16): Sidebar fixa a partir de 1024 px, drawer abaixo, Topbar
 * com ☰, título, sino e Menu do usuário, e o conteúdo com o respiro do Brand Kit.
 */
export function AppShell({
  title,
  user,
  activeProfile,
  userMenuGroups,
  navigation,
  status,
  notifications,
  children,
}: AppShellProps) {
  const { t } = useTranslation('layout');
  const { t: tCommon } = useTranslation('common');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerId = useId();
  const logo = <Logo label={tCommon('appName')} />;

  return (
    <div className="kore-app-shell">
      <Sidebar logo={logo} navLabel={t('mainMenu')}>
        {navigation}
      </Sidebar>
      <SidebarDrawer
        id={drawerId}
        open={drawerOpen}
        onOpenChange={({ open }) => setDrawerOpen(open)}
        title={t('mainMenu')}
        closeLabel={t('closeMenu')}
        logo={logo}
        navLabel={t('mainMenu')}
      >
        {navigation}
      </SidebarDrawer>
      <div className="kore-app-shell__main">
        <Topbar
          title={title}
          {...(status !== undefined && { status })}
          menuLabel={t('openMenu')}
          onMenuClick={() => setDrawerOpen(true)}
          menuExpanded={drawerOpen}
          menuControls={drawerId}
          actions={
            <>
              {notifications && (
                <IconButton
                  icon={<Bell size={20} strokeWidth={1.75} />}
                  label={
                    notifications.unread > 9
                      ? t('notificationsUnreadMany')
                      : notifications.unread > 0
                        ? t('notificationsUnread', { count: notifications.unread })
                        : t('notifications')
                  }
                  count={notifications.unread}
                  onClick={notifications.onOpen}
                />
              )}
              <UserMenu
                user={user}
                {...(activeProfile !== undefined && { activeProfile })}
                groups={userMenuGroups}
                label={t('userMenu')}
              />
            </>
          }
        />
        <main className="kore-app-shell__content">{children}</main>
      </div>
    </div>
  );
}
