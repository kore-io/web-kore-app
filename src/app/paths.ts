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
  /** Convidados › Grupos e convidados (decisão 198); busca e filtros na query. */
  guests: '/app/convidados',
  /** Convidados › Tags (decisão 198). */
  guestTags: '/app/convidados/tags',
  /** Convidados › Lixeira (decisão 198). */
  guestTrash: '/app/convidados/lixeira',
  /** Painel do grupo (decisão 198): link próprio, para compartilhar e para o voltar. */
  guestParty: '/app/convidados/grupos/:partyId',
} as const;

/** Caminho do Painel de um grupo. */
export function guestPartyPath({ partyId }: { partyId: string }) {
  return paths.guestParty.replace(':partyId', encodeURIComponent(partyId));
}

/** Endereços fora do app. */
export const externalUrls = {
  /** "Fazer parceria" na F0 (decisões 150(4) e 157(4)); na F6, o cadastro do cerimonialista. */
  plannerPartnership: 'https://kore.com.br/cerimonialistas',
} as const;
