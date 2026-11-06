import type { MeResponse } from '../../../shared/api/generated/model';
import type { ProfileKind } from './me-active-profile';

/*
 * O GET /v1/me completo do contrato do vault, com os dados dos cartões da Seleção de
 * perfil (decisão 174(7)), enquanto a API do homolog devolve só user, activeProfile e
 * authenticatedAt. Na sincronização do openapi.json, sai daqui e vem do client gerado.
 */

export interface MeMembership {
  weddingId: string;
  role: 'owner' | 'collaborator' | 'planner';
  /** "Ana & Marcos". */
  weddingName: string;
  eventDate?: string | null;
  city?: string | null;
  state?: string | null;
}

export interface MePlannerProfile {
  organization: string;
  weddingsCount: number;
}

export interface MeWithProfiles extends MeResponse {
  memberships?: MeMembership[];
  profiles?: ProfileKind[];
  lastProfileOnDevice?: ProfileKind | null;
  planner?: MePlannerProfile | null;
}
