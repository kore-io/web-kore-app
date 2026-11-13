import { Outlet, useParams } from 'react-router';
import { AreaProvider, plannerWeddingBase } from '../area';

/**
 * A área da colaboradora dentro de um casamento (Colaboradora RN01, RN09): as telas do
 * casal com o casamento da rota e o caminho-base `/cerimonialista/casamentos/:weddingId`.
 * Aqui é só a montagem; a moldura dela (a faixa, a Sidebar com o Voltar a Meus casamentos
 * e o seletor de casamento) e o gate pelo perfil vêm no D5 do plano da F6.
 */
export function PlannerWeddingArea() {
  const { weddingId = '' } = useParams();
  return (
    <AreaProvider area={{ base: plannerWeddingBase({ weddingId }), weddingId, kind: 'planner' }}>
      <Outlet />
    </AreaProvider>
  );
}
