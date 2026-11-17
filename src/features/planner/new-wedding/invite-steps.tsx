import { Alert, Button, Input, Textarea, useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { areaPaths, plannerWeddingBase } from '../../../app/area';
import { paths } from '../../../app/paths';
import { useAccessInvitationsControllerSendV1 } from '../../../shared/api/generated/access-invitations/access-invitations';
import {
  useMeControllerMeV1,
  usePlannerControllerReferrerV1,
} from '../../../shared/api/generated/me/me';
import type { MyWeddingDetailResponse } from '../../../shared/api/generated/model';
import {
  getMyWeddingsControllerDetailV1QueryKey,
  getMyWeddingsControllerListV1QueryKey,
} from '../../../shared/api/generated/planner/planner';
import { ApiError, apiErrorCode } from '../../../shared/api/http-client';
import { FormField } from '../../../shared/components/form-field';
import { isValidEmail } from '../../access/email';
import { CoupleLinkBlock } from '../my-weddings/couple-link-block';
import { coupleName, shortDate } from '../my-weddings/my-weddings-filters';
import { useCoupleLinkActions } from '../my-weddings/use-couple-link-actions';
import { coupleInvitations } from '../my-weddings/wedding-detail-texts';
import { WeddingStatusBadge } from '../my-weddings/wedding-status-badge';

const MESSAGE_MAX = 500;

/** Como o passo 3 terminou: o convite por e-mail, o link ou o Convidar depois (RN06). */
export type InviteOutcome =
  { kind: 'email'; emails: string[] } | { kind: 'link' } | { kind: 'later' };

type InviteField = 'email' | 'otherEmail' | 'message';

/**
 * O passo 3 · Convidar o casal (Novo casamento RN05; Penpot 05; decisão 281): os dois
 * e-mails e a mensagem opcionais, o aviso do desconto do casal (o `discountPercent` da conta,
 * sem o percentual da comissão), e Enviar convite, Gerar link (sem e-mail) ou Convidar depois.
 * O casamento já existe: sem o Voltar (decisão 281(1)).
 */
export function InviteStep({
  weddingId,
  onDone,
}: {
  weddingId: string;
  onDone: (outcome: InviteOutcome) => void;
}) {
  const { t } = useTranslation('planner');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const me = useMeControllerMeV1();
  const referrer = usePlannerControllerReferrerV1({ query: { retry: false } });
  const send = useAccessInvitationsControllerSendV1();
  const [values, setValues] = useState<Record<InviteField, string>>({
    email: '',
    otherEmail: '',
    message: '',
  });
  const [errors, setErrors] = useState<Partial<Record<InviteField, string>>>({});

  const filled = (['email', 'otherEmail'] as const).filter((field) => values[field].trim());
  const withEmail = filled.length > 0;
  const discount = referrer.data?.discountPercent ?? null;

  function change(field: InviteField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => key !== field)),
    );
  }

  function validate(): boolean {
    const found: Partial<Record<InviteField, string>> = {};
    const own = me.data?.user.email.toLowerCase();
    for (const field of filled) {
      const address = values[field].trim();
      if (!isValidEmail({ email: address })) found[field] = t('newWedding.invite.errors.email');
      else if (address.toLowerCase() === own) found[field] = t('newWedding.invite.errors.ownEmail');
    }
    if (withEmail && values.message.length > MESSAGE_MAX) {
      found.message = t('newWedding.invite.errors.messageTooLong');
    }
    setErrors(found);
    return Object.keys(found).length === 0;
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;
    const emails = filled.map((field) => values[field].trim());
    const message = values.message.trim();
    send.mutate(
      {
        weddingId,
        // A mensagem vai só no e-mail (RN05).
        data: {
          kind: 'couple',
          ...(withEmail && { emails, ...(message && { message }) }),
        },
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: getMyWeddingsControllerDetailV1QueryKey(weddingId),
          });
          void queryClient.invalidateQueries({ queryKey: getMyWeddingsControllerListV1QueryKey() });
          onDone(withEmail ? { kind: 'email', emails } : { kind: 'link' });
        },
        onError: (error) => {
          // Um e-mail de outra forma de entrar da conta dela (RN05, ajuda de tela).
          if (apiErrorCode({ error }) === 'SELF_INVITATION') {
            setErrors({ [filled[0] ?? 'email']: t('newWedding.invite.errors.ownEmail') });
            return;
          }
          if (error instanceof ApiError && error.status === 400 && withEmail) {
            setErrors({ [filled[0] ?? 'email']: t('newWedding.invite.errors.email') });
            return;
          }
          showToast({
            tone: 'danger',
            message: `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
          });
        },
      },
    );
  }

  const fieldError = (field: InviteField) =>
    errors[field] !== undefined ? { hint: errors[field], hintTone: 'danger' as const } : {};

  return (
    <form className="kore-new-wedding__card" noValidate onSubmit={submit}>
      <FormField
        label={t('newWedding.invite.email')}
        optionalText={t('newWedding.optional')}
        {...(errors.email !== undefined
          ? fieldError('email')
          : { hint: t('newWedding.invite.emailHint') })}
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            type="email"
            autoComplete="off"
            value={values.email}
            invalid={invalid}
            onChange={(event) => change('email', event.target.value)}
            {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
          />
        )}
      </FormField>
      <FormField
        label={t('newWedding.invite.otherEmail')}
        optionalText={t('newWedding.optional')}
        {...fieldError('otherEmail')}
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            type="email"
            autoComplete="off"
            value={values.otherEmail}
            invalid={invalid}
            onChange={(event) => change('otherEmail', event.target.value)}
            {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
          />
        )}
      </FormField>
      <FormField
        label={t('newWedding.invite.message')}
        optionalText={t('newWedding.optional')}
        {...fieldError('message')}
      >
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            rows={4}
            value={values.message}
            invalid={invalid}
            onChange={(event) => change('message', event.target.value)}
            {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
          />
        )}
      </FormField>
      {discount !== null && (
        <Alert tone="info">{t('newWedding.invite.discount', { percent: discount })}</Alert>
      )}
      <div className="kore-new-wedding__footer kore-new-wedding__footer--end">
        <Button
          type="button"
          variant="secondary"
          disabled={send.isPending}
          onClick={() => onDone({ kind: 'later' })}
        >
          {t('newWedding.invite.later')}
        </Button>
        <Button type="submit" disabled={send.isPending} aria-busy={send.isPending || undefined}>
          {withEmail ? t('newWedding.invite.send') : t('newWedding.invite.generateLink')}
        </Button>
      </div>
    </form>
  );
}

/**
 * O passo 4 · Pronto (Novo casamento RN06; Penpot 05; decisão 280): "Casamento criado.", o
 * texto do caso (com convite ou sem convite), o Badge do status com "{casal} · {data} ·
 * {cidade (UF)}", o bloco Link para o casal (com link) e os Próximos passos.
 */
export function DoneStep({
  detail,
  outcome,
  onInvite,
}: {
  detail: MyWeddingDetailResponse;
  outcome: InviteOutcome;
  onInvite: () => void;
}) {
  const { t } = useTranslation('planner');
  const navigate = useNavigate();
  const { weddingId } = detail;
  const linkActions = useCoupleLinkActions({ weddingId });
  const { link } = coupleInvitations({ detail });
  const invited = outcome.kind !== 'later';
  const site = areaPaths(plannerWeddingBase({ weddingId })).site;
  const line = [
    coupleName(detail),
    detail.eventDate ? shortDate({ date: detail.eventDate }) : '',
    `${detail.city} (${detail.state})`,
  ]
    .filter(Boolean)
    .join(' · ');
  const [first, second] = outcome.kind === 'email' ? outcome.emails : [];

  return (
    <section className="kore-new-wedding__card" aria-labelledby="kore-new-wedding-done">
      <span className="kore-new-wedding__done-mark" aria-hidden="true">
        <Check strokeWidth={2.4} />
      </span>
      <h2 id="kore-new-wedding-done" className="kore-new-wedding__done-title">
        {t('newWedding.done.title')}
      </h2>
      {outcome.kind === 'email' && (
        <p className="kore-new-wedding__done-text">
          {second
            ? t('newWedding.done.sentTwo', { first, second })
            : t('newWedding.done.sentOne', { email: first })}
        </p>
      )}
      {outcome.kind === 'later' && (
        <p className="kore-new-wedding__done-text">{t('newWedding.done.later')}</p>
      )}
      <div className="kore-new-wedding__done-status">
        <WeddingStatusBadge status={detail.status} />
        <span>{line}</span>
      </div>

      {outcome.kind === 'link' && link && (
        <CoupleLinkBlock
          link={link}
          busy={linkActions.busy}
          onRegenerate={linkActions.regenerate}
          onCancel={() => linkActions.cancelLink({ id: link.id })}
        />
      )}

      <section className="kore-new-wedding__next" aria-labelledby="kore-new-wedding-next">
        <h3 id="kore-new-wedding-next" className="kore-new-wedding__next-title">
          {t('newWedding.done.nextSteps')}
        </h3>
        <ul className="kore-new-wedding__next-list">
          {[
            t('newWedding.done.nextBuildSite'),
            t('newWedding.done.nextGuests'),
            ...(invited ? [t('newWedding.done.nextFollow')] : []),
          ].map((item) => (
            <li key={item}>
              <Check aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <div className="kore-new-wedding__footer kore-new-wedding__footer--done">
        {invited ? (
          <Button type="button" variant="ghost" onClick={() => void navigate(paths.plannerArea)}>
            {t('newWedding.done.toMyWeddings')}
          </Button>
        ) : (
          <Button type="button" variant="secondary" onClick={onInvite}>
            {t('newWedding.done.inviteCouple')}
          </Button>
        )}
        <Button type="button" onClick={() => void navigate(site)}>
          {t('newWedding.done.buildSite')}
        </Button>
      </div>
    </section>
  );
}
