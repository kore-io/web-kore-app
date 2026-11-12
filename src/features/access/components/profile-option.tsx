import { Badge } from '@kore-io/design';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

export interface ProfileOptionProps {
  /** Ícone do Lucide (24 px, decorativo) no círculo. */
  icon: ReactNode;
  title: string;
  description: string;
  /** O último perfil usado neste aparelho: borda em destaque e o selo. */
  highlightLabel?: string;
  onSelect: () => void;
}

/** Cartão de perfil da Seleção de perfil (Acessos, Penpot): ícone, título, apoio e seta. */
export function ProfileOption({
  icon,
  title,
  description,
  highlightLabel,
  onSelect,
}: ProfileOptionProps) {
  const highlighted = highlightLabel !== undefined;
  return (
    <button
      type="button"
      className={
        highlighted ? 'kore-profile-option kore-profile-option--highlighted' : 'kore-profile-option'
      }
      onClick={onSelect}
    >
      <span className="kore-profile-option__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="kore-profile-option__text">
        <span className="kore-profile-option__title">{title}</span>{' '}
        <span className="kore-profile-option__description">{description}</span>
        {highlighted && (
          <>
            {' '}
            <Badge tone="highlight" className="kore-profile-option__badge">
              {highlightLabel}
            </Badge>
          </>
        )}
      </span>
      <ChevronRight
        className="kore-profile-option__chevron"
        aria-hidden="true"
        strokeWidth={1.75}
      />
    </button>
  );
}
