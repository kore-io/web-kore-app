import { useMeControllerChooseProfileV1 } from '../../../shared/api/generated/me/me';
import type { SetActiveProfileBodyProfile } from '../../../shared/api/generated/model';

export type ProfileKind = SetActiveProfileBodyProfile;

/** POST /v1/me/active-profile (RN14 e RN16 do Login; home do casal em /app, decisão 173(e)). */
export const useSetActiveProfile = useMeControllerChooseProfileV1;
