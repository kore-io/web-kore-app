import { useMeControllerMeV1 } from '../../../shared/api/generated/me/me';

/** Versão das frases (decisão 189(1)): "vocês" para o casal, singular para a cerimonialista. */
export type Audience = 'couple' | 'planner';

/**
 * Casamento aberto na área do casal, pelo GET /v1/me que o layout já carregou: o de dono,
 * como no título da Topbar (decisão 163), ou o primeiro vínculo. A versão das frases segue
 * o perfil ativo: o casal no plural, a cerimonialista e o vendedor no singular; na F1 só o
 * casal entra na área (decisões 152 e 198).
 */
export function useActiveWedding() {
  const { data: me } = useMeControllerMeV1();
  const membership = me?.memberships.find((item) => item.role === 'owner') ?? me?.memberships[0];
  // O vendedor também lê no singular (textos-f2: "vendedor antes do aceite").
  const audience: Audience = !me || me.activeProfile === 'couple' ? 'couple' : 'planner';
  return { weddingId: membership?.weddingId, audience };
}
