import { useArea } from '../../../app/area';
import { useMeControllerMeV1 } from '../../../shared/api/generated/me/me';

/** Versão das frases (decisão 189(1)): "vocês" para o casal, singular para a cerimonialista. */
export type Audience = 'couple' | 'planner';

/**
 * O casamento aberto e a versão das frases.
 *
 * - Na área da colaboradora (`/cerimonialista/casamentos/:weddingId`), o casamento vem da
 *   rota e as frases ficam no singular, pela área e não pelo perfil ativo (Colaboradora
 *   RN01, RN09): duas abas podem abrir dois casamentos, e trocar o perfil numa não muda a
 *   outra. A API confere o vínculo a cada pedido.
 * - Na área do casal (`/app`), pelo GET /v1/me que o layout já carregou: o de dono, como
 *   no título da Topbar (decisão 163), ou o primeiro vínculo; a versão segue o perfil
 *   ativo (o casal no plural; a cerimonialista e o vendedor no singular).
 */
export function useActiveWedding() {
  const area = useArea();
  const { data: me } = useMeControllerMeV1();
  if (area.weddingId !== undefined) {
    const membership = me?.memberships.find((item) => item.weddingId === area.weddingId);
    return {
      weddingId: area.weddingId,
      audience: 'planner' as Audience,
      role: membership?.role,
    };
  }
  const membership = me?.memberships.find((item) => item.role === 'owner') ?? me?.memberships[0];
  // O vendedor também lê no singular (textos-f2: "vendedor antes do aceite").
  const audience: Audience = !me || me.activeProfile === 'couple' ? 'couple' : 'planner';
  return { weddingId: membership?.weddingId, audience, role: membership?.role };
}
