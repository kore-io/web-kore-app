/**
 * Caminhos do app (decisões 139, 146 e 147). Os de token saem nos e-mails e não podem
 * mudar sem atualizar a API e a IA.
 */
export const paths = {
  /** Entrar; o código é um passo da mesma tela. Trata `?error=google_unverified|blocked`. */
  signIn: '/entrar',
  /** Botão do e-mail de código: `?token=` (chama o verify). */
  signInConfirm: '/entrar/confirmar',
  /** Volta do login com Google: `?step=&next=`. */
  signInGoogle: '/entrar/google',
  /** Convites de acesso (parceiro, casal e cerimonialista). */
  invite: '/convite/:token',
  /** Seleção de perfil. */
  profiles: '/perfis',
  /** Criar conta e casamento (Primeiro acesso do casal). */
  signUp: '/cadastro',
  sessionExpired: '/sessao-expirada',
  /** Área do casal; o Dashboard é a raiz. */
  coupleArea: '/app',
  /**
   * A colaboradora dentro de um casamento (Colaboradora RN01; decisão 223 D2): as mesmas
   * telas da Área do Casal, com o casamento da rota. Os caminhos das telas vêm do
   * `areaPaths` (src/app/area.tsx), a partir do caminho-base da área.
   */
  plannerWedding: '/cerimonialista/casamentos/:weddingId',
  /**
   * Área do cerimonialista (Cadastro e perfil RN07): Meus casamentos é a raiz. A moldura
   * chegou no D3 da F6; as telas de cada item chegam nos PRs seguintes (D4 a D9) e, até lá,
   * a rota fica em branco dentro da moldura (decisões 250(d) e 254).
   */
  plannerArea: '/cerimonialista',
  /** Novo casamento (D6); o caminho estático vale sobre o `:weddingId`. */
  plannerNewWedding: '/cerimonialista/casamentos/novo',
  /** Link de indicação (D7). */
  plannerReferral: '/cerimonialista/link-de-indicacao',
  /** Modelos (D8). */
  plannerTemplates: '/cerimonialista/modelos',
  /** Notificações da cerimonialista, pelo sino (D9; decisão 254(2)). */
  plannerNotifications: '/cerimonialista/notificacoes',
  /** Meu perfil (Cadastro e perfil RN09). */
  plannerProfile: '/cerimonialista/perfil',
  /** Configurações (RN11): abre em Acesso; a aba Notificações liga no D9 (254(3)). */
  plannerSettings: '/cerimonialista/configuracoes',
  plannerSettingsAccess: '/cerimonialista/configuracoes/acesso',
  plannerSettingsNotifications: '/cerimonialista/configuracoes/notificacoes',
  /** Cadastro do cerimonialista (Cadastro e perfil RN01): o Fazer parceria do app. */
  plannerSignUp: '/cerimonialista/cadastro',
} as const;
