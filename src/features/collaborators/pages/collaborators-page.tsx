import { Avatar, Button, Dialog, PageHeader, useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useArea } from '../../../app/area';
import { paths } from '../../../app/paths';
import { getMeControllerMeV1QueryKey } from '../../../shared/api/generated/me/me';
import {
  getWeddingMembersControllerListV1QueryKey,
  useWeddingMembersControllerListV1,
  useWeddingMembersControllerRemoveV1,
} from '../../../shared/api/generated/memberships/memberships';
import type { WeddingMemberResponse } from '../../../shared/api/generated/model';
import {
  getMyWeddingsControllerListV1QueryKey,
  useMyWeddingsControllerDetailV1,
} from '../../../shared/api/generated/planner/planner';
import { ApiError, apiErrorCode } from '../../../shared/api/http-client';
import { LoadErrorNotice } from '../../../shared/components/load-error';
import { useWeddingTimezone } from '../../../shared/use-wedding-timezone';
import { useActiveWedding } from '../../guests/hooks/use-active-wedding';
import { coupleName } from '../../planner/my-weddings/my-weddings-filters';
import { InvitePlanner, PendingPlannerInvitation } from '../components/planner-invitation';
import { availableAtText, initials, memberGroups, cardDate } from '../collaborators-texts';

/**
 * Colaboradores (Papéis RN02, RN03 e RN06a; Colaboradora RN05; decisões 270 e 271), nas
 * duas áreas, cada uma como no Penpot:
 * - **casal** (Área do Casal 23): o Casal e a Cerimonialista, com as permissões no rodapé e
 *   o Remover da cerimonialista, com a confirmação e a trava de 48 h;
 * - **colaboradora** (Área do Cerimonialista 17): a lista em leitura, Convidar e Remover
 *   desabilitados com o motivo e o Sair deste casamento (o mesmo do detalhe, RN10).
 * O vendedor não aparece (271(4)). Sem cerimonialista, o casal convida uma, ou acompanha
 * o convite pendente (D5c; decisão 276).
 */
export function CollaboratorsPage() {
  const { weddingId } = useActiveWedding();
  const { kind } = useArea();
  if (!weddingId) return null;
  return kind === 'planner' ? (
    <PlannerCollaborators weddingId={weddingId} />
  ) : (
    <CoupleCollaborators weddingId={weddingId} />
  );
}

function useMembers({ weddingId }: { weddingId: string }) {
  const members = useWeddingMembersControllerListV1(weddingId);
  const timezone = useWeddingTimezone({ weddingId });
  return { members, timezone };
}

/** Uma pessoa: o avatar, o nome e, na cerimonialista, o "Desde 05/08" (271(1) e 274). */
function MemberRow({
  member,
  timezone,
  withSince,
  action,
}: {
  member: WeddingMemberResponse;
  timezone: string | null;
  withSince: boolean;
  action?: React.ReactNode;
}) {
  const { t } = useTranslation('collaborators');
  const name = member.name ?? '';
  return (
    <li className="kore-collaborators__member">
      <Avatar initials={initials({ name })} />
      <div className="kore-collaborators__who">
        <span className="kore-collaborators__name">{name}</span>
        {withSince && (
          <span className="kore-collaborators__since">
            {t('since', { date: cardDate({ at: member.since, timezone }) })}
          </span>
        )}
      </div>
      {action}
    </li>
  );
}

function CoupleCollaborators({ weddingId }: { weddingId: string }) {
  const { t } = useTranslation('collaborators');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { members, timezone } = useMembers({ weddingId });
  const remove = useWeddingMembersControllerRemoveV1();
  const [removing, setRemoving] = useState<WeddingMemberResponse | null>(null);
  const ownersId = useId();
  const plannersId = useId();

  function confirmRemove() {
    if (!removing) return;
    const name = removing.name ?? '';
    remove.mutate(
      { weddingId, id: removing.id },
      {
        onSuccess: () => {
          setRemoving(null);
          void queryClient.invalidateQueries({
            queryKey: getWeddingMembersControllerListV1QueryKey(weddingId),
          });
          showToast({ tone: 'success', message: t('couple.removeDialog.done', { name }) });
        },
        onError: (error) => {
          setRemoving(null);
          // A trava de 48 h depois da troca do e-mail de acesso (Papéis RN06a).
          if (apiErrorCode({ error }) === 'RECENT_ACCESS_CHANGE') {
            const body = (error as ApiError<{ availableAt?: string }>).body;
            const date = body.availableAt
              ? availableAtText({ at: body.availableAt, timezone })
              : '';
            showToast({ tone: 'danger', message: t('couple.recentAccessChange', { date }) });
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

  const header = <PageHeader title={t('title')} description={t('couple.description')} />;
  if (members.isError) {
    return (
      <div className="kore-collaborators">
        {header}
        <LoadErrorNotice onRetry={() => void members.refetch()} />
      </div>
    );
  }
  const { owners, planners } = memberGroups({ members: members.data?.members ?? [] });
  // O convite de cerimonialista pendente, enquanto ninguém aceitou (decisão 276).
  const pendingPlanner = members.data?.pendingInvitations.find(
    (invitation) => invitation.kind === 'planner',
  );
  return (
    <div className="kore-collaborators">
      {header}
      {members.data && (
        <div className="kore-collaborators__cards kore-collaborators__cards--couple">
          <section className="kore-collaborators__card" aria-labelledby={ownersId}>
            <h2 id={ownersId} className="kore-collaborators__overline">
              {t('couple.ownersTitle')}
            </h2>
            <ul className="kore-collaborators__list">
              {owners.map((member) => (
                <MemberRow key={member.id} member={member} timezone={timezone} withSince={false} />
              ))}
            </ul>
            <p className="kore-collaborators__help">{t('couple.ownersHelp')}</p>
          </section>
          <section className="kore-collaborators__card" aria-labelledby={plannersId}>
            <h2 id={plannersId} className="kore-collaborators__overline">
              {t('couple.plannersTitle')}
            </h2>
            {planners.length > 0 && (
              <ul className="kore-collaborators__list">
                {planners.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    timezone={timezone}
                    withSince
                    action={
                      <Button
                        type="button"
                        variant="destructive"
                        aria-label={t('couple.removeName', { name: member.name ?? '' })}
                        onClick={() => setRemoving(member)}
                      >
                        {t('couple.remove')}
                      </Button>
                    }
                  />
                ))}
              </ul>
            )}
            {planners.length > 0 ? (
              <p className="kore-collaborators__help">{t('couple.plannersHelp')}</p>
            ) : pendingPlanner ? (
              <PendingPlannerInvitation
                weddingId={weddingId}
                invitation={pendingPlanner}
                timezone={timezone}
              />
            ) : (
              <InvitePlanner weddingId={weddingId} />
            )}
          </section>
        </div>
      )}
      <Dialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        role="alertdialog"
        title={t('couple.removeDialog.title', { name: removing?.name ?? '' })}
        description={t('couple.removeDialog.description', { name: removing?.name ?? '' })}
        actions={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              {t('couple.removeDialog.cancel')}
            </Button>
            <Button variant="destructive" disabled={remove.isPending} onClick={confirmRemove}>
              {t('couple.removeDialog.confirm')}
            </Button>
          </>
        }
      />
    </div>
  );
}

function PlannerCollaborators({ weddingId }: { weddingId: string }) {
  const { t } = useTranslation('collaborators');
  const { t: tPlanner } = useTranslation('planner');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { members, timezone } = useMembers({ weddingId });
  const detail = useMyWeddingsControllerDetailV1(weddingId);
  const leave = useWeddingMembersControllerRemoveV1();
  const [leaving, setLeaving] = useState(false);
  const ownersId = useId();
  const plannersId = useId();
  const reasonId = useId();

  const all = members.data?.members ?? [];
  const { owners, planners } = memberGroups({ members: all });
  const me = all.find((member) => member.isMe);
  const couple = detail.data ? coupleName(detail.data) : '';

  function confirmLeave() {
    if (!me) return;
    leave.mutate(
      { weddingId, id: me.id },
      {
        onSuccess: () => {
          // Primeiro sai da moldura; depois o /me e a lista relidos (Colaboradora RN05).
          void navigate(paths.plannerArea, { replace: true });
          void queryClient.invalidateQueries({ queryKey: getMyWeddingsControllerListV1QueryKey() });
          void queryClient.invalidateQueries({ queryKey: getMeControllerMeV1QueryKey() });
          showToast({
            tone: 'success',
            message: tPlanner('myWeddings.detail.leaveDialog.done', { couple }),
          });
        },
        onError: () => {
          setLeaving(false);
          showToast({
            tone: 'danger',
            message: `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
          });
        },
      },
    );
  }

  const header = <PageHeader title={t('title')} />;
  if (members.isError) {
    return (
      <div className="kore-collaborators">
        {header}
        <LoadErrorNotice onRetry={() => void members.refetch()} />
      </div>
    );
  }
  return (
    <div className="kore-collaborators">
      {header}
      {members.data && (
        <>
          <div className="kore-collaborators__cards">
            <section className="kore-collaborators__card" aria-labelledby={ownersId}>
              <h2 id={ownersId} className="kore-collaborators__title">
                {t('planner.ownersTitle')}
              </h2>
              <ul className="kore-collaborators__list">
                {owners.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    timezone={timezone}
                    withSince={false}
                  />
                ))}
              </ul>
            </section>
            <section className="kore-collaborators__card" aria-labelledby={plannersId}>
              <h2 id={plannersId} className="kore-collaborators__title">
                {t('planner.plannersTitle')}
              </h2>
              <ul className="kore-collaborators__list">
                {planners.map((member) => (
                  <MemberRow key={member.id} member={member} timezone={timezone} withSince />
                ))}
              </ul>
              {/* Papéis RN03: ela não gerencia colaboradores; os botões com o motivo. */}
              <div className="kore-collaborators__actions">
                <Button type="button" variant="secondary" disabled aria-describedby={reasonId}>
                  {t('planner.invite')}
                </Button>
                <Button type="button" variant="secondary" disabled aria-describedby={reasonId}>
                  {t('planner.remove')}
                </Button>
              </div>
              <p id={reasonId} className="kore-collaborators__help">
                {t('planner.onlyCouple')}
              </p>
            </section>
          </div>
          {/* Sair só quando o casamento tem dono (Meus casamentos RN10). */}
          {me && owners.length > 0 && (
            <Button
              type="button"
              variant="secondary"
              className="kore-collaborators__leave"
              onClick={() => setLeaving(true)}
            >
              {t('planner.leave')}
            </Button>
          )}
        </>
      )}
      <Dialog
        open={leaving}
        onOpenChange={(open) => setLeaving(open)}
        role="alertdialog"
        title={tPlanner('myWeddings.detail.leaveDialog.title', { couple })}
        description={tPlanner('myWeddings.detail.leaveDialog.description')}
        actions={
          <>
            <Button variant="secondary" onClick={() => setLeaving(false)}>
              {tPlanner('myWeddings.detail.leaveDialog.cancel')}
            </Button>
            <Button variant="destructive" disabled={leave.isPending} onClick={confirmLeave}>
              {tPlanner('myWeddings.detail.leaveDialog.confirm')}
            </Button>
          </>
        }
      />
    </div>
  );
}
