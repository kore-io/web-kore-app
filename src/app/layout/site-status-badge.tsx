import { Badge } from '@kore-io/design';
import { Check, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { siteStatus } from '../../features/site/site-texts';

/**
 * O selo de status do site na Topbar (Dashboard RN07; Penpot 03; decisão 239(B3)): os
 * rótulos do Selo de status (decisão 90). Publicado em verde com o ✓; Rascunho com o
 * ícone de documento; os outros em cinza. No celular a Topbar não mostra o selo: ele fica
 * no cartão Status do site do Dashboard.
 */
export function SiteStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation('site');
  const known = siteStatus(status);
  if (!known) return null;
  if (known === 'published') {
    return (
      <Badge tone="success" icon={<Check strokeWidth={2.4} />}>
        {t(`status.${known}`)}
      </Badge>
    );
  }
  return (
    <Badge tone="neutral" {...(known === 'draft' && { icon: <FileText /> })}>
      {t(`status.${known}`)}
    </Badge>
  );
}
