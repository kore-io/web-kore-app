import { useMutation } from '@tanstack/react-query';
import { httpClient } from '../../../shared/api/http-client';

/*
 * POST /v1/me/active-profile, escrito à mão pelo contrato do vault (com o home do casal em
 * /app, decisão 173(e)), enquanto a rota não chega ao openapi.json do homolog.
 */

export type ProfileKind = 'couple' | 'planner' | 'seller';

export interface ActiveProfileResponse {
  activeProfile: ProfileKind;
  /** Página inicial do perfil ('/app' no casal). */
  home: string;
}

export function useSetActiveProfile() {
  return useMutation({
    mutationFn: ({ profile }: { profile: ProfileKind }) =>
      httpClient<ActiveProfileResponse>('/v1/me/active-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile }),
      }),
  });
}
