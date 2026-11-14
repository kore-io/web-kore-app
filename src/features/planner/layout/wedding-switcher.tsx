import { Badge, Input } from '@kore-io/design';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { plannerWeddingBase } from '../../../app/area';
import type { MeMembershipResponse } from '../../../shared/api/generated/model';
import { shortDate } from '../my-weddings/my-weddings-filters';

/** Sem acento e sem diferenciar maiúsculas, como a busca de Meus casamentos. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

/** "Ana e Marcos" a partir do "Ana & Marcos" do /me (Colaboradora RN02, Pena). */
function coupleOf({ weddingName }: { weddingName: string }): string {
  return weddingName.replace(/\s*&\s*/, ' e ');
}

/**
 * O seletor de casamento na Topbar da colaboradora (Colaboradora RN02 e RN06; Penpot 17,
 * A11): o botão com o nome do casal ("Trocar de casamento" para o leitor de tela) abre a
 * lista dos casamentos em que ela colabora, do `memberships[]` do /me (sem o de dona), com
 * a busca "Buscar casal", o atual com o selo "Atual" e `aria-current`, e o vazio "Nenhum
 * casamento com esse nome.". Escolher um abre o Dashboard dele.
 */
export function WeddingSwitcher({
  weddingId,
  title,
  memberships,
}: {
  weddingId: string;
  title: string;
  memberships: readonly MeMembershipResponse[];
}) {
  const { t } = useTranslation('planner');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const panelId = useId();
  const searchId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // O título da Topbar corta o que transborda: o painel sai por portal, sob o botão.
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPosition({ top: rect.bottom + 8, left: Math.max(16, rect.left) });
  }, [open]);

  const weddings = memberships
    .filter((membership) => membership.role === 'collaborator')
    .sort((a, b) => (a.eventDate ?? '9999').localeCompare(b.eventDate ?? '9999'));
  const found = weddings.filter((wedding) =>
    normalize(coupleOf(wedding)).includes(normalize(search)),
  );

  // Fecha no Esc (o foco volta ao botão) e no clique fora.
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    function onPointer(event: PointerEvent) {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <div className="kore-wedding-switcher" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="kore-wedding-switcher__button"
        aria-label={t('weddingArea.switcher.label')}
        aria-expanded={open}
        {...(open && { 'aria-controls': panelId })}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{title}</span>
        <Chevron aria-hidden="true" className="kore-wedding-switcher__chevron" />
      </button>
      {open &&
        createPortal(
          <div
            id={panelId}
            ref={panelRef}
            className="kore-wedding-switcher__panel"
            style={{ top: position.top, left: position.left }}
          >
            <Input
              id={searchId}
              type="search"
              aria-label={t('weddingArea.switcher.search')}
              placeholder={t('weddingArea.switcher.search')}
              value={search}
              // O foco vai à busca ao abrir (A11).
              autoFocus
              onChange={(event) => setSearch(event.target.value)}
            />
            {found.length === 0 ? (
              <p className="kore-wedding-switcher__empty">{t('weddingArea.switcher.noResults')}</p>
            ) : (
              <ul className="kore-wedding-switcher__list">
                {found.map((wedding) => {
                  const current = wedding.weddingId === weddingId;
                  return (
                    <li key={wedding.weddingId}>
                      <Link
                        className="kore-wedding-switcher__item"
                        to={plannerWeddingBase({ weddingId: wedding.weddingId })}
                        {...(current && { 'aria-current': 'page' as const })}
                        onClick={() => setOpen(false)}
                      >
                        <span>
                          {coupleOf(wedding)}
                          <span className="kore-wedding-switcher__date">
                            {' · '}
                            {wedding.eventDate
                              ? shortDate({ date: wedding.eventDate })
                              : t('weddingArea.switcher.noDate')}
                          </span>
                        </span>
                        {current && (
                          <Badge tone="neutral">{t('weddingArea.switcher.current')}</Badge>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
