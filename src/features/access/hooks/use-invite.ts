import { useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { paths } from '../../../app/paths';
import {
  getMeControllerMeV1QueryKey,
  useMeControllerMeV1,
} from '../../../shared/api/generated/me/me';
import { ApiError, apiErrorCode } from '../../../shared/api/http-client';
import {
  useAcceptInvitation,
  useAccessInvitation,
  useDeclineInvitation,
  type AcceptInvitationBody,
  type AccessInvitation,
  type AcceptInvitationResponse,
} from '../api/access-invitations';
import { useSetActiveProfile } from '../api/me-active-profile';
import type { WhoAreYouValues } from '../components/who-are-you-step';
import {
  clearAccepting,
  clearInviteToken,
  isAccepting,
  markAccepting,
  saveInviteToken,
} from '../invite-storage';
import type { SignInLocationState } from '../sign-in-location-state';

/** Em que ponto do convite a pessoa está. */
export type InviteStage =
  | { name: 'loading' }
  | { name: 'failed' }
  /**
   * Vencido, usado, recusado, cancelado ou substituído (RN12; decisões 172(6) e 174(4)), ou
   * vendedor no convite do cerimonialista (decisão 175).
   */
  | { name: 'invalid' }
  /** Dona de outro casamento (RN08; decisão 172(3) revista). */
  | { name: 'already-owner' }
  /** A tela do convite (parceiro, casal ou cerimonialista). */
  | { name: 'invite'; invitation: AccessInvitation }
  /** Outra conta (RN07). */
  | { name: 'other-account'; invitation: AccessInvitation; currentEmail: string }
  /** Quem é você? (casal: nome e título; parceiro sem título: só o título; 172 e 174(5)). */
  | { name: 'who-are-you'; invitation: AccessInvitation };

/** O Entrar volta ao convite: origem invite e o token guardado (RN06, decisão 142). */
const INVITE_SIGN_IN_STATE: SignInLocationState = { origin: 'invite' };

/**
 * Convite de acesso (/convite/:token; spec Convites de acesso, RN06 a RN12; decisões 142,
 * 168, 172, 173 e 174): lê o convite, guia o aceite (login, Outra conta, Quem é você?,
 * Seu nome), aceita e abre o casamento; ou recusa.
 */
export function useInvite({ token }: { token: string }) {
  const { t } = useTranslation('access');
  const { showToast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const me = useMeControllerMeV1();
  const signedOut = me.error instanceof ApiError && me.error.status === 401;
  const viewer = me.data?.user;
  const meSettled = me.isSuccess || signedOut;

  const invitationQuery = useAccessInvitation({
    token,
    viewerId: viewer?.id ?? null,
    enabled: meSettled,
  });
  const accept = useAcceptInvitation();
  const decline = useDeclineInvitation();
  const setActiveProfile = useSetActiveProfile();

  /** A pessoa tocou em Aceitar (agora, ou antes do login, decisão 142). */
  const [accepting, setAccepting] = useState(() => isAccepting({ token }));
  const [otherAccountConfirmed, setOtherAccountConfirmed] = useState(false);
  const [outcome, setOutcome] = useState<'invalid' | 'already-owner'>();
  const [nameError, setNameError] = useState<string>();
  const autoAccepted = useRef(false);
  /** A marca do aceite pedido antes do login se consome uma vez (decisão 142). */
  const acceptingConsumed = useRef(false);

  useEffect(() => saveInviteToken({ token }), [token]);

  const invitation = invitationQuery.data;
  const invitationGone =
    invitationQuery.error instanceof ApiError && invitationQuery.error.status === 410;
  const signedIn = viewer !== undefined;

  /** Passa a sessão ao perfil de casal e abre o Dashboard (RN14 e RN16 do Login). */
  function openCoupleArea() {
    setActiveProfile.mutate(
      { profile: 'couple' },
      {
        onSettled: () => {
          void queryClient.resetQueries({ queryKey: getMeControllerMeV1QueryKey() });
          void navigate(paths.coupleArea, { replace: true });
        },
      },
    );
  }

  /**
   * Depois de aceitar: o dono já está no perfil de casal (decisão 178) e vai ao Dashboard;
   * o cerimonialista (colaborador) vai à Seleção de perfil (174(4)).
   */
  function openWedding({ role }: { role: AcceptInvitationResponse['role'] }) {
    clearInviteToken();
    void queryClient.resetQueries({ queryKey: getMeControllerMeV1QueryKey() });
    void navigate(role === 'owner' ? paths.coupleArea : paths.profiles, { replace: true });
  }

  /** Já faz parte do casamento (ALREADY_MEMBER): abre direto, sem gravar nada (172(3)). */
  function openExistingWedding() {
    clearInviteToken();
    if (invitation?.kind === 'planner') {
      void queryClient.resetQueries({ queryKey: getMeControllerMeV1QueryKey() });
      void navigate(paths.profiles, { replace: true });
    } else openCoupleArea();
  }

  function showGenericError() {
    showToast({
      tone: 'danger',
      message: `${t('alerts.generic.title')}. ${t('alerts.generic.description')}`,
    });
  }

  function goToSignIn() {
    markAccepting({ token });
    void navigate(paths.signIn, { state: INVITE_SIGN_IN_STATE });
  }

  function send({
    extra = {},
  }: { extra?: Omit<AcceptInvitationBody, 'confirmOtherAccount'> } = {}) {
    if (!invitation) return;
    accept.mutate(
      { token, data: { confirmOtherAccount: otherAccountConfirmed, ...extra } },
      {
        onSuccess: ({ role }) => openWedding({ role }),
        onError: (error) => {
          const code = apiErrorCode({ error });
          if (error instanceof ApiError && error.status === 401) goToSignIn();
          else if (code === 'EMAIL_MISMATCH') setOtherAccountConfirmed(false);
          else if (code === 'ALREADY_MEMBER') openExistingWedding();
          else if (code === 'ALREADY_OWNER') setOutcome('already-owner');
          else if (
            code === 'INVITATION_INVALID' ||
            code === 'OWNERS_FULL' ||
            code === 'PLANNER_ALREADY' ||
            code === 'SELLER_CANNOT_BE_PLANNER'
          ) {
            setOutcome('invalid');
          } else if (error instanceof ApiError && error.status === 400 && invitation.needsName) {
            setNameError(t('plannerInvite.nameError'));
          } else showGenericError();
        },
      },
    );
  }

  const mismatch =
    signedIn &&
    invitation !== undefined &&
    invitation.sessionEmailMismatch &&
    !otherAccountConfirmed &&
    (accepting || apiErrorCode({ error: accept.error }) === 'EMAIL_MISMATCH');

  /** O que falta perguntar antes de gravar o aceite. */
  const needsWhoAreYou =
    invitation !== undefined &&
    (invitation.kind === 'couple' ||
      (invitation.kind === 'partner' && invitation.wedding.partnerTitleNeeded === true));
  const needsName = invitation?.kind === 'planner' && invitation.needsName === true;

  // Com sessão e o aceite pedido, sem nada a perguntar: grava o aceite uma vez só.
  useEffect(() => {
    if (!accepting || !signedIn || !invitation || invitationQuery.isFetching) return;
    if (!acceptingConsumed.current) {
      acceptingConsumed.current = true;
      clearAccepting();
    }
    if (mismatch || needsWhoAreYou || needsName || autoAccepted.current) return;
    autoAccepted.current = true;
    send();
  }, [
    accepting,
    signedIn,
    invitation,
    invitationQuery.isFetching,
    mismatch,
    needsWhoAreYou,
    needsName,
  ]);

  function startAccept() {
    if (!signedIn) {
      goToSignIn();
      return;
    }
    setAccepting(true);
  }

  function stage(): InviteStage {
    if (outcome === 'invalid' || invitationGone) return { name: 'invalid' };
    if (outcome === 'already-owner') return { name: 'already-owner' };
    if (!meSettled && !me.isError) return { name: 'loading' };
    if ((me.isError && !signedOut) || invitationQuery.isError) return { name: 'failed' };
    if (!invitation) return { name: 'loading' };
    if (mismatch && viewer) {
      return { name: 'other-account', invitation, currentEmail: viewer.email };
    }
    if (accepting && signedIn && needsWhoAreYou) return { name: 'who-are-you', invitation };
    return { name: 'invite', invitation };
  }

  return {
    stage: stage(),
    signedIn,
    submitting: accept.isPending || decline.isPending || setActiveProfile.isPending,
    nameError,
    /** Aceitar convite / Aceitar e virar dono. */
    startAccept,
    /** Sem sessão, antes do login do parceiro (Google ou e-mail): o aceite continua depois. */
    markAccepting: () => {
      markAccepting({ token });
      setAccepting(true);
    },
    /** Outra conta → Sim, usar {e-mail}. */
    confirmOtherAccount: () => setOtherAccountConfirmed(true),
    /** Quem é você? → Continuar. */
    submitWhoAreYou: ({ partnerIndex, myTitle }: WhoAreYouValues) =>
      send({ extra: { myTitle, ...(partnerIndex !== undefined && { partnerIndex }) } }),
    /** Convite do cerimonialista → Aceitar convite (com o Seu nome, se pedido). */
    acceptAsPlanner: ({ name }: { name?: string }) => {
      if (!signedIn) {
        goToSignIn();
        return;
      }
      if (needsName && !name) {
        setNameError(t('plannerInvite.nameError'));
        return;
      }
      setNameError(undefined);
      send({ extra: name ? { name } : {} });
    },
    /** Você já tem um casamento → Abrir meu casamento. */
    openMyWedding: () => {
      clearInviteToken();
      openCoupleArea();
    },
    decline: () =>
      decline.mutate(
        { token },
        {
          onSuccess: () => {
            clearInviteToken();
            showToast({ tone: 'success', message: t('invite.declined') });
            void navigate(signedIn ? paths.profiles : paths.signIn, { replace: true });
          },
          onError: (error) => {
            if (apiErrorCode({ error }) === 'INVITATION_INVALID') setOutcome('invalid');
            else showGenericError();
          },
        },
      ),
    /** Convite inválido → Entrar no Kore. */
    signIn: () => {
      clearInviteToken();
      void navigate(paths.signIn, { replace: true });
    },
    retry: () => {
      void me.refetch();
      void invitationQuery.refetch();
    },
    inviteSignInState: INVITE_SIGN_IN_STATE,
  };
}
