import { CalendarCheck, LayoutDashboard, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LoadError } from '../../../shared/components/load-error';
import { AccessLayout } from '../components/access-layout';
import { ProfileOption } from '../components/profile-option';
import { ProfilesStep } from '../components/profiles-step';
import { useProfiles } from '../hooks/use-profiles';
import { useSignOut } from '../hooks/use-sign-out';
import { plannerProfileDescription, weddingProfileDescription } from '../profile-texts';

/** Seleção de perfil (/perfis; Acessos, Penpot): com perfis, a escolha; sem perfil, os dois começos. */
export function ProfilesPage() {
  const { t } = useTranslation('access');
  const profiles = useProfiles();
  const signOut = useSignOut();

  if (profiles.failed) {
    return (
      <AccessLayout showLegal={false}>
        <LoadError onRetry={profiles.retry} />
      </AccessLayout>
    );
  }
  if (profiles.loading || !profiles.me) return null;

  const { me, couple, planner, lastUsed } = profiles;
  const highlight = (profile: string) =>
    lastUsed === profile ? { highlightLabel: t('profiles.lastUsed') } : {};

  if (profiles.profiles.length === 0) {
    return (
      <AccessLayout showLegal={false}>
        <ProfilesStep
          title={t('profiles.noneTitle')}
          description={t('profiles.noneDescription', { email: me.user.email })}
          onUseAnotherAccount={signOut}
        >
          <ProfileOption
            icon={<CalendarCheck strokeWidth={1.75} />}
            title={t('profiles.createWedding')}
            description={t('profiles.createWeddingDescription')}
            onSelect={profiles.createWedding}
          />
          <ProfileOption
            icon={<Users strokeWidth={1.75} />}
            title={t('profiles.partner')}
            description={t('profiles.partnerDescription')}
            onSelect={profiles.partnership}
          />
        </ProfilesStep>
      </AccessLayout>
    );
  }

  const name = me.user.name?.trim().split(/\s+/)[0] ?? me.user.email;
  return (
    <AccessLayout showLegal={false}>
      <ProfilesStep
        title={t('profiles.chooseTitle')}
        description={t('profiles.chooseDescription', { name })}
        onUseAnotherAccount={signOut}
      >
        {profiles.profiles.includes('planner') && planner && (
          <ProfileOption
            icon={<LayoutDashboard strokeWidth={1.75} />}
            title={t('profiles.planner')}
            description={plannerProfileDescription({
              t,
              organization: planner.organization,
              weddingCount: planner.weddingsCount,
            })}
            {...highlight('planner')}
            onSelect={() => profiles.choose({ profile: 'planner' })}
          />
        )}
        {profiles.profiles.includes('couple') && couple && (
          <ProfileOption
            icon={<CalendarCheck strokeWidth={1.75} />}
            title={t('profiles.weddingTitle', { couple: couple.weddingName })}
            description={weddingProfileDescription({
              t,
              ...(couple.eventDate && { isoDate: couple.eventDate }),
              ...(couple.city && { city: couple.city }),
              ...(couple.state && { state: couple.state }),
            })}
            {...highlight('couple')}
            onSelect={() => profiles.choose({ profile: 'couple' })}
          />
        )}
      </ProfilesStep>
    </AccessLayout>
  );
}
