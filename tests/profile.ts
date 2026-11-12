/**
 * O perfil do /me nos testes de tela. O padrão é o casal; o teste da versão da
 * cerimonialista (decisão 198(2)) troca para 'planner' e abre a tela com o
 * renderAreaScreen. O setup volta para o casal depois de cada teste.
 */
export const profileUnderTest: { current: 'couple' | 'planner' | 'seller' } = {
  current: 'couple',
};

interface MeFixture {
  activeProfile: string;
  profiles: string[];
  lastProfileOnDevice: string;
  memberships: { role: string }[];
}

/** O /me do arquivo de teste no perfil escolhido (a cerimonialista entra como colaboradora). */
export function meFor<T extends MeFixture>(me: T): T {
  const profile = profileUnderTest.current;
  if (profile === 'couple') return me;
  return {
    ...me,
    activeProfile: profile,
    profiles: [profile],
    lastProfileOnDevice: profile,
    memberships: me.memberships.map((membership) => ({ ...membership, role: 'collaborator' })),
  };
}
