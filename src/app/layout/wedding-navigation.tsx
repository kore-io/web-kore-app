import { NavItem } from '@kore-io/design';
import { Globe, LayoutDashboard, Music, Send, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useMatch } from 'react-router';
import type { AreaPaths } from '../area';

/**
 * Os itens do casamento na Sidebar (Dashboard, Convidados, Envios, Site e Músicas), nas duas
 * molduras: a do casal (`/app`) e a da colaboradora (`/cerimonialista/casamentos/:id`;
 * Colaboradora RN02). Músicas só com a pergunta de música ligada (Música RN03).
 */
export function WeddingNavigation({
  area,
  songsEnabled,
}: {
  area: AreaPaths;
  songsEnabled: boolean;
}) {
  const { t } = useTranslation('layout');
  // O Dashboard só na raiz: telas sem item na Sidebar (ex.: Publicar o site) não marcam nada.
  const onDashboard = useMatch({ path: area.dashboard, end: true }) !== null;
  const onGuests = useMatch({ path: area.guests, end: false }) !== null;
  const onSite = useMatch({ path: area.site, end: false }) !== null;
  const onDeliveries = useMatch({ path: area.deliveries, end: false }) !== null;
  const onSongs = useMatch({ path: area.songs, end: false }) !== null;
  return (
    <>
      <NavItem asChild icon={<LayoutDashboard />} current={onDashboard}>
        <Link to={area.dashboard}>{t('nav.dashboard')}</Link>
      </NavItem>
      <NavItem asChild icon={<Users />} current={onGuests}>
        <Link to={area.guests}>{t('nav.guests')}</Link>
      </NavItem>
      <NavItem asChild icon={<Send />} current={onDeliveries}>
        <Link to={area.deliveries}>{t('nav.deliveries')}</Link>
      </NavItem>
      <NavItem asChild icon={<Globe />} current={onSite}>
        <Link to={area.site}>{t('nav.site')}</Link>
      </NavItem>
      {songsEnabled && (
        <NavItem asChild icon={<Music />} current={onSongs}>
          <Link to={area.songs}>{t('nav.songs')}</Link>
        </NavItem>
      )}
    </>
  );
}
