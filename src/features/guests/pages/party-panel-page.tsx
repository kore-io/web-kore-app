import {
  ActionMenu,
  Badge,
  Button,
  Dialog,
  PageHeader,
  Tag,
  type BadgeTone,
} from '@kore-io/design';
import { Check, Clock, X } from 'lucide-react';
import { useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { guestPartyEditPath, paths } from '../../../app/paths';
import type {
  PartyGuestResponse,
  PartyGuestResponseRsvpStatus,
  PartyResponse,
} from '../../../shared/api/generated/model';
import { LoadErrorNotice } from '../../../shared/components/load-error';
import { ChangeResponseDialog } from '../components/change-response-dialog';
import { MoveGuestDialog } from '../components/move-guest-dialog';
import { historyAt, historyLine } from '../party-history';
import { TrashDialog } from '../components/trash-dialog';
import { useOpenPreview } from '../../site/preview/use-open-preview';
import { useActiveWedding, type Audience } from '../hooks/use-active-wedding';
import { useMoveGuest } from '../hooks/use-move-guest';
import { useTrash } from '../hooks/use-trash';
import { usePartyPanel } from '../hooks/use-party-panel';

/** Selo da resposta do convidado, como os Badges do DS. */
const rsvpBadges: Record<PartyGuestResponseRsvpStatus, { tone: BadgeTone; icon: ReactNode }> = {
  confirmed: { tone: 'success', icon: <Check strokeWidth={2.4} /> },
  pending: { tone: 'warning', icon: <Clock /> },
  declined: { tone: 'danger', icon: <X strokeWidth={2.4} /> },
};

/** Painel do grupo (RN14 de Grupos e convidados), em /app/convidados/grupos/:partyId. */
export function PartyPanelPage() {
  const { partyId = '' } = useParams();
  const { weddingId, audience } = useActiveWedding();
  if (!weddingId) return null;
  return <PartyPanel weddingId={weddingId} partyId={partyId} audience={audience} />;
}

function PartyPanel({
  weddingId,
  partyId,
  audience,
}: {
  weddingId: string;
  partyId: string;
  audience: Audience;
}) {
  const { t } = useTranslation('guests');
  const panel = usePartyPanel({ weddingId, partyId });
  const mover = useMoveGuest({ weddingId, audience });
  const trash = useTrash({ weddingId, audience });
  const openPreview = useOpenPreview({ weddingId });
  const navigate = useNavigate();
  const [trashingParty, setTrashingParty] = useState(false);
  const [trashingGuest, setTrashingGuest] = useState<{ id: string; name: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [moving, setMoving] = useState<{ id: string; name: string } | null>(null);
  const [answering, setAnswering] = useState<PartyGuestResponse | null>(null);
  // O ⋮ do convidado que abriu o Mover de grupo: o foco volta a ele (o item do menu some).
  const menuButton = useRef<HTMLElement | null>(null);

  if (panel.notFound) return <Navigate to={paths.guests} replace />;
  if (panel.isError) return <LoadErrorNotice onRetry={panel.retry} />;
  const { party } = panel;
  if (!party) return null;

  return (
    <div className="kore-party-panel">
      <Link to={paths.guests} className="kore-party-panel__back">
        {t('panel.back')}
      </Link>
      <PageHeader
        title={party.name}
        description={panelSummary({ t, party })}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirming(true)}>
              {t('panel.regenerate')}
            </Button>
            <Button onClick={() => void navigate(guestPartyEditPath({ partyId: party.id }))}>
              {t('partyForm.editButton')}
            </Button>
          </>
        }
      />
      <div className="kore-party-panel__cards">
        <GroupCard party={party} />
        <GuestsCard
          guests={party.guests}
          onChangeResponse={({ guest, trigger }) => {
            menuButton.current = trigger;
            setAnswering(guest);
          }}
          onTrash={({ guest, trigger }) => {
            menuButton.current = trigger;
            // O último convidado com nome não sai (Grupos RN08; Lixeira RN04).
            const named = party.guests.filter((item) => item.name !== null).length;
            if (named <= 1) mover.lastGuest();
            else setTrashingGuest(guest);
          }}
          onMove={({ guest, trigger }) => {
            menuButton.current = trigger;
            // O último convidado com nome não sai do grupo (RN08): o aviso, sem o Dialog.
            const named = party.guests.filter((item) => item.name !== null).length;
            if (named <= 1) mover.lastGuest();
            else setMoving(guest);
          }}
        />
        {/* Grupo e Convidados em cima, Histórico e Link do grupo embaixo (Penpot A8). */}
        <HistoryCard party={party} />
        <LinkCard
          party={party}
          audience={audience}
          onPreview={() => openPreview({ mode: 'party', partyId: party.id })}
          onCopy={(url) => void panel.copyLink({ url })}
          onTrash={() => setTrashingParty(true)}
        />
      </div>
      <ChangeResponseDialog
        weddingId={weddingId}
        partyId={party.id}
        version={party.version}
        audience={audience}
        guest={answering}
        returnFocusRef={menuButton}
        onClose={() => setAnswering(null)}
      />
      <MoveGuestDialog
        weddingId={weddingId}
        audience={audience}
        guest={moving}
        fromPartyId={party.id}
        isMoving={mover.isMoving}
        returnFocusRef={menuButton}
        onClose={() => setMoving(null)}
        onMove={(toParty) =>
          moving &&
          mover.move({
            guestId: moving.id,
            guestName: moving.name,
            fromPartyId: party.id,
            toParty,
            onDone: () => setMoving(null),
          })
        }
      />
      <TrashDialog
        open={trashingParty}
        title={t('trash.party.title', { name: party.name })}
        description={t('trash.party.description', {
          count: party.guests.filter((guest) => guest.name !== null).length,
        })}
        isPending={trash.isTrashing}
        onClose={() => setTrashingParty(false)}
        onConfirm={() =>
          trash.trashParty({
            partyId: party.id,
            name: party.name,
            onDone: (ok) => {
              setTrashingParty(false);
              // O grupo saiu da lista: o Painel volta para ela.
              if (ok) void navigate(paths.guests);
            },
          })
        }
      />
      <TrashDialog
        open={trashingGuest !== null}
        title={t('trash.guest.title', { name: trashingGuest?.name ?? '' })}
        description={t('trash.guest.description')}
        isPending={trash.isTrashing}
        returnFocusRef={menuButton}
        onClose={() => setTrashingGuest(null)}
        onConfirm={() =>
          trashingGuest &&
          trash.trashGuest({
            guestId: trashingGuest.id,
            name: trashingGuest.name,
            onDone: () => setTrashingGuest(null),
          })
        }
      />
      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('panel.regenerateDialog.title', { name: party.name })}
        description={t(`panel.regenerateDialog.${audience}`)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              {t('panel.regenerateDialog.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={panel.isRegenerating}
              onClick={() => panel.regenerateLink({ onDone: () => setConfirming(false) })}
            >
              {t('panel.regenerateDialog.confirm')}
            </Button>
          </>
        }
      />
    </div>
  );
}

type GuestsT = ReturnType<typeof useTranslation<'guests'>>['t'];

/**
 * "3 convidados · Contato: Célia Moreira · Família da Ana" (RN14): conta os convidados com
 * nome; sem contato, a parte do contato sai; as tags do grupo separadas por vírgula.
 */
function panelSummary({ t, party }: { t: GuestsT; party: PartyResponse }) {
  const named = party.guests.filter((guest) => guest.name !== null);
  const contact = party.guests.find((guest) => guest.id === party.contactGuestId);
  return [
    t('panel.summary.guests', { count: named.length }),
    contact?.name && t('panel.summary.contact', { name: contact.name }),
    party.tags.length > 0 && party.tags.map((tag) => tag.name).join(', '),
  ]
    .filter(Boolean)
    .join(' · ');
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="kore-party-panel__card">
      <h2 className="kore-party-panel__card-title">{title}</h2>
      {children}
    </section>
  );
}

function GroupCard({ party }: { party: PartyResponse }) {
  const { t } = useTranslation('guests');
  const contact = party.guests.find((guest) => guest.id === party.contactGuestId);
  const rows: [string, ReactNode][] = [
    [t('panel.group.contact'), contact?.name ?? '—'],
    // Mascarados no servidor (decisões 186(11) e 202): o número e o e-mail inteiros só
    // servem ao formulário de edição.
    [t('panel.group.phone'), contact?.phoneMasked ?? '—'],
    [t('panel.group.email'), contact?.emailMasked ?? '—'],
    [
      t('panel.group.plusOneSlots'),
      party.plusOneSlots === 0 ? t('panel.group.plusOneSlotsNone') : party.plusOneSlots,
    ],
    [
      t('panel.group.tags'),
      party.tags.length === 0 ? (
        '—'
      ) : (
        <span className="kore-party-panel__tags">
          {party.tags.map((tag) => (
            <Tag key={tag.id} color={tag.color}>
              {tag.name}
            </Tag>
          ))}
        </span>
      ),
    ],
  ];
  return (
    <Card title={t('panel.group.title')}>
      <dl className="kore-party-panel__rows">
        {rows.map(([label, value]) => (
          <div key={label} className="kore-party-panel__row">
            <dt className="kore-party-panel__label">{label}</dt>
            <dd className="kore-party-panel__value">{value}</dd>
          </div>
        ))}
      </dl>
      {party.internalNote && (
        <p className="kore-party-panel__note">
          {t('panel.group.internalNote', { note: party.internalNote })}
        </p>
      )}
    </Card>
  );
}

type GuestAction = (args: {
  guest: { id: string; name: string };
  trigger: HTMLElement | null;
}) => void;

type ResponseAction = (args: { guest: PartyGuestResponse; trigger: HTMLElement | null }) => void;

function GuestsCard({
  guests,
  onChangeResponse,
  onMove,
  onTrash,
}: {
  guests: PartyGuestResponse[];
  onChangeResponse: ResponseAction;
  onMove: GuestAction;
  onTrash: GuestAction;
}) {
  const { t } = useTranslation('guests');
  return (
    <Card title={t('panel.guests.title')}>
      <ul className="kore-party-panel__guests">
        {guests.map((guest) => (
          <GuestItem
            key={guest.id}
            guest={guest}
            onChangeResponse={onChangeResponse}
            onMove={onMove}
            onTrash={onTrash}
          />
        ))}
      </ul>
    </Card>
  );
}

/**
 * Um convidado: nome (ou "Acompanhante", a vaga vazia), faixa etária e restrição, o selo
 * da resposta e, para quem tem nome, o ⋮ com Mover de grupo (decisão 201) e Mover para a
 * lixeira (Lixeira RN02 e RN04); a vaga vazia não tem o ⋮ (RN10).
 */
function GuestItem({
  guest,
  onChangeResponse,
  onMove,
  onTrash,
}: {
  guest: PartyGuestResponse;
  onChangeResponse: ResponseAction;
  onMove: GuestAction;
  onTrash: GuestAction;
}) {
  const { t } = useTranslation('guests');
  const actions = useRef<HTMLSpanElement>(null);
  const badge = rsvpBadges[guest.rsvpStatus];
  const { name } = guest;
  const details = [
    guest.ageGroup && t(`panel.guests.ageGroup.${guest.ageGroup}`),
    guest.dietaryRestriction,
  ].filter(Boolean);
  return (
    <li className="kore-party-panel__guest">
      <span className="kore-party-panel__guest-text">
        <span className="kore-party-panel__guest-name">{name ?? t('panel.guests.plusOne')}</span>
        {details.length > 0 && (
          <span className="kore-party-panel__guest-details">{details.join(' · ')}</span>
        )}
      </span>
      <span className="kore-party-panel__guest-status">
        <Badge tone={badge.tone} icon={badge.icon}>
          {t(`panel.guests.rsvp.${guest.rsvpStatus}`)}
        </Badge>
        <span ref={actions} className="kore-party-panel__guest-actions">
          <ActionMenu
            label={t('panel.guests.actions', { name: name ?? t('panel.guests.plusOne') })}
            // Alterar resposta (Prazo RN04), Mover de grupo e Mover para a lixeira; a vaga
            // de acompanhante só tem o Alterar resposta. O ⋮ lido só no clique.
            groups={
              guest.isPlusOne || name === null
                ? [
                    [
                      {
                        id: 'response',
                        label: t('panel.response.action'),
                        onSelect: () =>
                          onChangeResponse({
                            guest,
                            trigger: actions.current?.querySelector('button') ?? null,
                          }),
                      },
                    ],
                  ]
                : [
                    [
                      {
                        id: 'response',
                        label: t('panel.response.action'),
                        onSelect: () =>
                          onChangeResponse({
                            guest,
                            trigger: actions.current?.querySelector('button') ?? null,
                          }),
                      },
                      {
                        id: 'move',
                        label: t('panel.move.action'),
                        onSelect: () =>
                          onMove({
                            guest: { id: guest.id, name },
                            trigger: actions.current?.querySelector('button') ?? null,
                          }),
                      },
                    ],
                    [
                      {
                        id: 'trash',
                        label: t('trash.action'),
                        destructive: true,
                        onSelect: () =>
                          onTrash({
                            guest: { id: guest.id, name },
                            trigger: actions.current?.querySelector('button') ?? null,
                          }),
                      },
                    ],
                  ]
            }
          />
        </span>
      </span>
    </li>
  );
}

/** O Histórico do grupo (Prazo e respostas RN05): oculto enquanto vazio. */
function HistoryCard({ party }: { party: PartyResponse }) {
  const { t } = useTranslation('guests');
  if (party.history.length === 0) return null;
  return (
    <Card title={t('panel.history.title')}>
      <ul className="kore-party-panel__history">
        {party.history.map((entry, index) => (
          <li key={`${entry.at}-${index}`} className="kore-party-panel__history-item">
            <span>{historyLine({ t, entry, plusOneLabel: t('panel.guests.plusOne') })}</span>
            <span className="kore-party-panel__history-at">{historyAt({ t, at: entry.at })}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function LinkCard({
  party,
  audience,
  onPreview,
  onCopy,
  onTrash,
}: {
  party: PartyResponse;
  audience: Audience;
  /** Ver como este grupo (Pré-visualização RN01): a prévia como o grupo, em nova aba. */
  onPreview: () => void;
  onCopy: (url: string) => void;
  onTrash: () => void;
}) {
  const { t } = useTranslation('guests');
  const { t: tSite } = useTranslation('site');
  const { url } = party.link;
  const helpId = useId();
  return (
    <Card title={t('panel.link.title')}>
      <p className="kore-party-panel__link">{url ?? '—'}</p>
      <p className="kore-party-panel__note">{t('panel.link.caption', { name: party.name })}</p>
      <div className="kore-party-panel__actions">
        <Button
          variant="secondary"
          size="sm"
          disabled={url === null}
          onClick={() => url && onCopy(url)}
        >
          {t('panel.link.copy')}
        </Button>
        {/* Sem endereço do site, não há link nem prévia: desabilitado com a mesma ajuda do
            Editor (Pré-visualização RN01; o servidor daria 409). */}
        <Button
          variant="secondary"
          size="sm"
          disabled={url === null}
          {...(url === null && { 'aria-describedby': helpId })}
          onClick={onPreview}
        >
          {t('panel.link.preview')}
        </Button>
        <Button variant="destructive" size="sm" onClick={onTrash}>
          {t('trash.action')}
        </Button>
      </div>
      {url === null && (
        <p id={helpId} className="kore-party-panel__note">
          {tSite(`previewSite.noSlug.${audience}`)}
        </p>
      )}
    </Card>
  );
}
