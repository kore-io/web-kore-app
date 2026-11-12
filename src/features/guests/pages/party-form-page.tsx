import { Button, Dialog, PageHeader, useToast } from '@kore-io/design';
import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { guestPartyPath, paths } from '../../../app/paths';
import {
  usePartiesControllerCreateV1,
  usePartiesControllerGetV1,
  usePartiesControllerUpdateV1,
} from '../../../shared/api/generated/parties/parties';
import type { PartyResponse } from '../../../shared/api/generated/model';
import { useTagsControllerListV1 } from '../../../shared/api/generated/tags/tags';
import { ApiError } from '../../../shared/api/http-client';
import { PartyForm } from '../components/party-form';
import { useActiveWedding, type Audience } from '../hooks/use-active-wedding';
import { useRefreshWedding, useSaveErrors } from '../hooks/use-party-save';
import {
  changedAnswered,
  draftFromParty,
  emptyDraft,
  toCreateBody,
  toUpdateBody,
  validateDraft,
  type FieldErrors,
  type PartyDraft,
} from '../party-form';

/** Novo grupo (Grupos e convidados RN03 a RN07; Penpot; decisão 213). */
export function NewPartyPage() {
  const { weddingId, audience } = useActiveWedding();
  if (!weddingId) return null;
  return <NewParty weddingId={weddingId} audience={audience} />;
}

/** Editar grupo (RN09; decisão 213(8)). */
export function EditPartyPage() {
  const { weddingId, audience } = useActiveWedding();
  const { partyId = '' } = useParams();
  if (!weddingId) return null;
  return <EditPartyLoader weddingId={weddingId} partyId={partyId} audience={audience} />;
}

function Frame({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation('guests');
  return (
    <div className="kore-party-form-page">
      <Link to={paths.guests} className="kore-party-panel__back">
        {t('panel.back')}
      </Link>
      <PageHeader title={title} description={t('partyForm.intro')} />
      {children}
    </div>
  );
}

function NewParty({ weddingId, audience }: { weddingId: string; audience: Audience }) {
  const { t } = useTranslation('guests');
  const { showToast } = useToast();
  const navigate = useNavigate();
  const tags = useTagsControllerListV1(weddingId);
  const create = usePartiesControllerCreateV1();
  const refresh = useRefreshWedding({ weddingId });
  const saveErrors = useSaveErrors();
  const [draft, setDraft] = useState<PartyDraft>(emptyDraft);
  const [errors, setErrors] = useState<FieldErrors>({});

  return (
    <Frame title={t('partyForm.newTitle')}>
      <PartyForm
        draft={draft}
        onChange={setDraft}
        errors={errors}
        audience={audience}
        tags={tags.data?.data ?? []}
        submitLabel={t('partyForm.save')}
        isSaving={create.isPending || create.isSuccess}
        onCancel={() => void navigate(paths.guests)}
        onSubmit={() => {
          const local = validateDraft(draft);
          setErrors(local);
          if (Object.keys(local).length > 0) return;
          create.mutate(
            { weddingId, data: toCreateBody(draft) },
            {
              onSuccess: () => {
                void refresh();
                showToast({ tone: 'success', message: t('partyForm.created') });
                void navigate(paths.guests);
              },
              onError: (error) => setErrors(saveErrors({ error, draft }).fields),
            },
          );
        }}
      />
    </Frame>
  );
}

function EditPartyLoader({
  weddingId,
  partyId,
  audience,
}: {
  weddingId: string;
  partyId: string;
  audience: Audience;
}) {
  const party = usePartiesControllerGetV1(weddingId, partyId);
  if (party.error instanceof ApiError && party.error.status === 404) {
    return <Navigate to={paths.guests} replace />;
  }
  if (!party.data) return null;
  return <EditParty weddingId={weddingId} party={party.data} audience={audience} />;
}

function EditParty({
  weddingId,
  party,
  audience,
}: {
  weddingId: string;
  party: PartyResponse;
  audience: Audience;
}) {
  const { t } = useTranslation('guests');
  const { showToast } = useToast();
  const navigate = useNavigate();
  const tags = useTagsControllerListV1(weddingId);
  const update = usePartiesControllerUpdateV1();
  const refresh = useRefreshWedding({ weddingId });
  const saveErrors = useSaveErrors();
  const original = useRef(draftFromParty(party));
  const [draft, setDraft] = useState<PartyDraft>(() => draftFromParty(party));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [plusOnesError, setPlusOnesError] = useState<string | undefined>();
  const [confirming, setConfirming] = useState(false);
  const panel = guestPartyPath({ partyId: party.id });

  function save() {
    setConfirming(false);
    update.mutate(
      { weddingId, partyId: party.id, data: toUpdateBody(draft) },
      {
        onSuccess: () => {
          void refresh();
          showToast({ tone: 'success', message: t('partyForm.saved') });
          void navigate(panel);
        },
        onError: (error) => {
          const result = saveErrors({ error, draft });
          setErrors(result.fields);
          setPlusOnesError(result.plusOnes);
        },
      },
    );
  }

  return (
    <Frame title={t('partyForm.editTitle')}>
      <PartyForm
        draft={draft}
        onChange={(next) => {
          setDraft(next);
          if (next.plusOneSlots !== draft.plusOneSlots) setPlusOnesError(undefined);
        }}
        errors={errors}
        audience={audience}
        tags={tags.data?.data ?? []}
        plusOnesError={plusOnesError}
        submitLabel={t('partyForm.saveChanges')}
        isSaving={update.isPending || update.isSuccess}
        onCancel={() => void navigate(panel)}
        onSubmit={() => {
          const local = validateDraft(draft);
          setErrors(local);
          if (Object.keys(local).length > 0) return;
          // Quem já respondeu: o aviso antes de salvar (RN09; 213(8)).
          if (changedAnswered({ draft, original: original.current })) setConfirming(true);
          else save();
        }}
      />
      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('partyForm.answered')}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              {t('partyForm.cancel')}
            </Button>
            <Button onClick={save}>{t('partyForm.saveChanges')}</Button>
          </>
        }
      />
    </Frame>
  );
}
