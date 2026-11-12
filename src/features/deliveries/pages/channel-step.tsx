import { Button, Input, Radio, Spinner, Textarea, useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import type { MessageTemplateResponse } from '../../../shared/api/generated/model';
import {
  getDeliveriesControllerGetQueueV1QueryKey,
  getMessageTemplatesControllerAllV1QueryKey,
  messageTemplatesControllerPutV1,
  useDeliveriesControllerGetQueueV1,
  useMessageTemplatesControllerAllV1,
} from '../../../shared/api/generated/rsvp/rsvp';
import { apiErrorCode } from '../../../shared/api/http-client';
import { FormField } from '../../../shared/components/form-field';
import type { Audience } from '../../guests/hooks/use-active-wedding';
import {
  hasLinkPlaceholder,
  needsLink,
  type DeliveryChannel,
  type DeliveryKind,
} from '../delivery-texts';
import { useDeliverySelection } from '../hooks/use-delivery-selection';
import type { Closed } from './send-page';

const BODY_MAX = 1000;
const SUBJECT_MAX = 120;
/** O QR entra no C5, só no convite (RN09). */
const CHANNELS: DeliveryChannel[] = ['whatsapp', 'email', 'link'];

/**
 * A etapa Canal e mensagem (Envios RN05 e RN06; Penpot A5): o canal da fila inteira, a
 * mensagem guardada do tipo (o padrão enquanto o casal não editou), o assunto no e-mail, a
 * ajuda dos marcadores, o {link} obrigatório no convite e no lembrete, o Restaurar a
 * mensagem padrão e a prévia com o 1º grupo marcado, montada pelo servidor.
 */
export function ChannelStep(props: {
  weddingId: string;
  audience: Audience;
  kind: DeliveryKind;
  closed: Closed;
}) {
  const { t } = useTranslation('deliveries');
  const templates = useMessageTemplatesControllerAllV1(props.weddingId);
  const template = templates.data?.items.find((item) => item.kind === props.kind);
  if (!template) {
    return (
      <div className="kore-send__loading">
        <Spinner label={t('title')} />
      </div>
    );
  }
  return (
    <ChannelForm key={`${template.body}|${template.subject}`} {...props} template={template} />
  );
}

function ChannelForm({
  weddingId,
  audience,
  kind,
  template,
}: {
  weddingId: string;
  audience: Audience;
  kind: DeliveryKind;
  closed: Closed;
  template: MessageTemplateResponse;
}) {
  const { t } = useTranslation('deliveries');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [, setSearch] = useSearchParams();
  const radioName = useId();
  const selection = useDeliverySelection({ weddingId, kind, visibleIds: [] });
  const [body, setBody] = useState(template.body);
  const [subject, setSubject] = useState(template.subject);
  const [saving, setSaving] = useState(false);
  const linkMissing = needsLink(kind) && !hasLinkPlaceholder(body);
  const dirty = body !== template.body || subject !== template.subject;
  const first = selection.ids[0];
  const preview = useDeliveriesControllerGetQueueV1(
    weddingId,
    { kind, partyIds: first ?? '' },
    { query: { enabled: Boolean(first) } },
  );
  const previewItem = preview.data?.items[0];

  async function refresh() {
    await queryClient.invalidateQueries({
      queryKey: getMessageTemplatesControllerAllV1QueryKey(weddingId),
    });
    // Todas as filas do casamento, e não só a da prévia: a fila de vários grupos tem outra
    // chave e sairia com as URLs da mensagem antiga (ponto do Crivo no C4).
    await queryClient.invalidateQueries({
      queryKey: getDeliveriesControllerGetQueueV1QueryKey(weddingId),
    });
  }

  function failed() {
    showToast({
      tone: 'danger',
      message: `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
    });
  }

  async function restore() {
    setSaving(true);
    try {
      await messageTemplatesControllerPutV1(weddingId, kind, { reset: true });
      await refresh();
    } catch {
      failed();
    } finally {
      setSaving(false);
    }
  }

  async function toQueue() {
    if (linkMissing || saving) return;
    setSaving(true);
    try {
      // A edição fica para os próximos envios (RN06); a fila lê a mensagem guardada.
      if (dirty) {
        await messageTemplatesControllerPutV1(weddingId, kind, {
          body,
          subject: subject.replace(/[\r\n]+/g, ' ').trim() || null,
        });
        await refresh();
      }
      setSearch({ etapa: 'fila' });
    } catch (error) {
      if (apiErrorCode({ error }) === 'LINK_PLACEHOLDER_MISSING') return;
      failed();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="kore-send kore-send--channel">
      <div className="kore-send__panel">
        <fieldset className="kore-send__channels">
          <legend className="kore-send__overline">{t('channel.label')}</legend>
          {CHANNELS.map((channel) => (
            <Radio
              key={channel}
              name={radioName}
              checked={selection.channel === channel}
              onChange={() => selection.setChannel(channel)}
            >
              {t(`channel.${channel}`)}
            </Radio>
          ))}
        </fieldset>
        {selection.channel === 'email' && (
          <FormField label={t('message.subject')}>
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                maxLength={SUBJECT_MAX}
                value={subject}
                onChange={(event) => setSubject(event.target.value.replace(/[\r\n]+/g, ' '))}
              />
            )}
          </FormField>
        )}
        <FormField
          label={t('message.body')}
          hint={
            linkMissing
              ? t(`message.linkMissing.${audience}`)
              : t(`message.help.${kind}.${audience}`)
          }
          hintTone={linkMissing ? 'danger' : 'neutral'}
        >
          {({ id, describedBy, invalid }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              rows={7}
              maxLength={BODY_MAX}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          )}
        </FormField>
        {(dirty || !template.isDefault) && (
          <button
            type="button"
            className="kore-send__restore"
            disabled={saving}
            onClick={() => {
              // Só mexeu na tela: volta ao guardado, que já é o padrão; senão, o reset.
              if (template.isDefault) {
                setBody(template.body);
                setSubject(template.subject);
              } else void restore();
            }}
          >
            {t('message.restore')}
          </button>
        )}
      </div>
      {previewItem && (
        <aside
          className="kore-send__preview"
          aria-label={t('message.previewTitle', { name: previewItem.name })}
        >
          <p className="kore-send__preview-title">
            {t('message.previewTitle', { name: previewItem.name })}
          </p>
          <p className="kore-send__preview-text">{previewItem.copyText}</p>
          <p className="kore-send__preview-note">
            {kind === 'save_the_date'
              ? t('message.previewNoteSaveTheDate')
              : t('message.previewNote')}
          </p>
        </aside>
      )}
      <div className="kore-send__bar">
        <Button variant="secondary" onClick={() => setSearch({})}>
          {t('message.back')}
        </Button>
        <Button disabled={linkMissing || saving} onClick={() => void toQueue()}>
          {t('message.toQueue', { count: selection.count })}
        </Button>
      </div>
    </div>
  );
}

export function tabOf(kind: DeliveryKind): 'invites' | 'saveTheDate' | 'reminder' {
  return kind === 'invite' ? 'invites' : kind === 'save_the_date' ? 'saveTheDate' : 'reminder';
}
