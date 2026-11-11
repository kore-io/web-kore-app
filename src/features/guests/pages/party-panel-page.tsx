import { Badge, Button, Dialog, PageHeader, Tag, type BadgeTone } from '@kore-io/design';
import { Check, Clock, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router';
import { paths } from '../../../app/paths';
import type {
  PartyGuestResponse,
  PartyGuestResponseRsvpStatus,
  PartyResponse,
} from '../../../shared/api/generated/model';
import { LoadErrorNotice } from '../../../shared/components/load-error';
import { useActiveWedding, type Audience } from '../hooks/use-active-wedding';
import { usePartyPanel } from '../hooks/use-party-panel';
import { maskPhone } from '../phone-mask';

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
  const [confirming, setConfirming] = useState(false);

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
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            {t('panel.regenerate')}
          </Button>
        }
      />
      <div className="kore-party-panel__cards">
        <GroupCard party={party} />
        <GuestsCard guests={party.guests} />
        <LinkCard party={party} onCopy={(url) => void panel.copyLink({ url })} />
      </div>
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
    [t('panel.group.phone'), contact?.phone ? maskPhone({ e164: contact.phone }) : '—'],
    [t('panel.group.email'), contact?.email ?? '—'],
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

function GuestsCard({ guests }: { guests: PartyGuestResponse[] }) {
  const { t } = useTranslation('guests');
  return (
    <Card title={t('panel.guests.title')}>
      <ul className="kore-party-panel__guests">
        {guests.map((guest) => {
          const badge = rsvpBadges[guest.rsvpStatus];
          const details = [
            guest.ageGroup && t(`panel.guests.ageGroup.${guest.ageGroup}`),
            guest.dietaryRestriction,
          ].filter(Boolean);
          return (
            <li key={guest.id} className="kore-party-panel__guest">
              <span className="kore-party-panel__guest-text">
                <span className="kore-party-panel__guest-name">
                  {guest.name ?? t('panel.guests.plusOne')}
                </span>
                {details.length > 0 && (
                  <span className="kore-party-panel__guest-details">{details.join(' · ')}</span>
                )}
              </span>
              <Badge tone={badge.tone} icon={badge.icon}>
                {t(`panel.guests.rsvp.${guest.rsvpStatus}`)}
              </Badge>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function LinkCard({ party, onCopy }: { party: PartyResponse; onCopy: (url: string) => void }) {
  const { t } = useTranslation('guests');
  const { url } = party.link;
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
      </div>
    </Card>
  );
}
