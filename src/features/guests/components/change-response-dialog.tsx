import { Button, Dialog, Input, Radio, useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { PartyGuestResponse } from '../../../shared/api/generated/model';
import {
  getPartiesControllerGetV1QueryKey,
  getPartiesControllerListV1InfiniteQueryKey,
} from '../../../shared/api/generated/parties/parties';
import {
  coupleResponsesControllerResponseV1,
  getDashboardControllerGetV1QueryKey,
} from '../../../shared/api/generated/rsvp/rsvp';
import { ApiError, apiErrorCode } from '../../../shared/api/http-client';
import { FormField } from '../../../shared/components/form-field';
import type { Audience } from '../hooks/use-active-wedding';

const DIET_MAX = 200;
const PLUS_ONE_NAME_MAX = 80;

type Answer = 'confirmed' | 'declined';

interface ChangeResponseDialogProps {
  weddingId: string;
  partyId: string;
  /** A `version` do grupo lida no Painel (Prazo RN04; R3-7). */
  version: number;
  audience: Audience;
  guest: PartyGuestResponse | null;
  returnFocusRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}

/**
 * Alterar resposta pelo casal (Prazo e respostas RN04; Penpot A8): "Alterar a resposta de
 * {nome}" (na vaga, "do acompanhante"), Vai · Não vai, a restrição e, na vaga, o nome do
 * acompanhante; Não vai avisa que a restrição e a música serão apagadas. A música não muda.
 * O 409 (o grupo mudou) fecha, recarrega o Painel e diz o porquê (decisão 232(7)).
 */
export function ChangeResponseDialog(props: ChangeResponseDialogProps) {
  // Cada abertura começa da resposta atual do convidado.
  return props.guest ? (
    <ChangeResponseForm key={props.guest.id} {...props} guest={props.guest} />
  ) : null;
}

function ChangeResponseForm({
  weddingId,
  partyId,
  version,
  audience,
  guest,
  onClose,
  returnFocusRef,
}: ChangeResponseDialogProps & { guest: PartyGuestResponse }) {
  const { t } = useTranslation('guests');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const radioName = useId();
  const formId = useId();
  const [answer, setAnswer] = useState<Answer | null>(
    guest.rsvpStatus === 'pending' ? null : guest.rsvpStatus,
  );
  const [diet, setDiet] = useState(guest.dietaryRestriction ?? '');
  const [name, setName] = useState(guest.isPlusOne ? (guest.name ?? '') : '');
  const [nameMissing, setNameMissing] = useState(false);
  const [saving, setSaving] = useState(false);

  function refresh() {
    void queryClient.invalidateQueries({
      queryKey: getPartiesControllerGetV1QueryKey(weddingId, partyId),
    });
    void queryClient.invalidateQueries({
      queryKey: getPartiesControllerListV1InfiniteQueryKey(weddingId),
    });
    void queryClient.invalidateQueries({
      queryKey: getDashboardControllerGetV1QueryKey(weddingId),
    });
  }

  async function save() {
    if (!answer || saving) return;
    // Na vaga, Vai pede o nome (RN04); Não vai sem nome é o "não vou levar".
    if (guest.isPlusOne && answer === 'confirmed' && !name.trim()) {
      setNameMissing(true);
      return;
    }
    setSaving(true);
    try {
      await coupleResponsesControllerResponseV1(weddingId, guest.id, {
        status: answer,
        version,
        dietaryRestriction: answer === 'confirmed' ? diet.trim() || null : null,
        ...(guest.isPlusOne && { name: answer === 'confirmed' ? name.trim() : null }),
      });
      refresh();
      showToast({ tone: 'success', message: t('panel.response.saved') });
      onClose();
    } catch (error) {
      const code = apiErrorCode({ error });
      refresh();
      onClose();
      showToast({
        tone: 'danger',
        message:
          code === 'RSVP_CHANGED'
            ? t(`panel.response.changed.${audience}`)
            : code === 'ACTION_NOT_ALLOWED' && error instanceof ApiError
              ? t('panel.response.afterDeadline')
              : `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
      });
    } finally {
      setSaving(false);
    }
  }

  const eraseName = guest.isPlusOne ? name.trim() || guest.name : guest.name;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      role="dialog"
      returnFocusRef={returnFocusRef}
      title={
        guest.isPlusOne
          ? t('panel.response.titlePlusOne')
          : t('panel.response.title', { name: guest.name ?? '' })
      }
      actions={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('panel.response.cancel')}
          </Button>
          <Button type="submit" form={formId} disabled={answer === null || saving}>
            {t('panel.response.save')}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="kore-change-response"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {/* Sem rótulo visível (Penpot A8): o grupo leva o nome do Dialog. */}
        <div
          className="kore-change-response__choice"
          role="radiogroup"
          aria-label={
            guest.isPlusOne
              ? t('panel.response.titlePlusOne')
              : t('panel.response.title', { name: guest.name ?? '' })
          }
        >
          <Radio
            name={radioName}
            checked={answer === 'confirmed'}
            onChange={() => setAnswer('confirmed')}
          >
            {t('panel.response.goes')}
          </Radio>
          <Radio
            name={radioName}
            checked={answer === 'declined'}
            onChange={() => setAnswer('declined')}
          >
            {t('panel.response.notGoes')}
          </Radio>
        </div>
        {answer === 'declined' && eraseName && (
          <p className="kore-change-response__note">
            {t('panel.response.willErase', { name: eraseName })}
          </p>
        )}
        {answer === 'confirmed' && guest.isPlusOne && (
          <FormField
            label={t('panel.response.plusOneName')}
            hintTone="danger"
            {...(nameMissing && { hint: t(`panel.response.plusOneNameMissing.${audience}`) })}
          >
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                maxLength={PLUS_ONE_NAME_MAX}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setNameMissing(false);
                }}
              />
            )}
          </FormField>
        )}
        {answer === 'confirmed' && (
          <FormField label={t('panel.response.diet')} hint={t('panel.response.dietHelp')}>
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                maxLength={DIET_MAX}
                placeholder={t('panel.response.dietPlaceholder')}
                value={diet}
                onChange={(event) => setDiet(event.target.value)}
              />
            )}
          </FormField>
        )}
      </form>
    </Dialog>
  );
}
