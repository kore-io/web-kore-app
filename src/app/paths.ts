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
  /** Convidados › Importar (decisão 198). */
  guestImport: '/app/convidados/importar',
  /** Convidados › Exportar (decisão 198). */
  guestExport: '/app/convidados/exportar',
  guestTags: '/app/convidados/tags',
  /** Convidados › Lixeira (decisão 198). */
  guestTrash: '/app/convidados/lixeira',
  /** Painel do grupo (decisão 198): link próprio, para compartilhar e para o voltar. */
  guestParty: '/app/convidados/grupos/:partyId',
  /** Novo grupo e Editar grupo (decisão 213(9)). */
  guestNew: '/app/convidados/novo',
  guestPartyEdit: '/app/convidados/grupos/:partyId/editar',
  /** Envios (IA da Área do Casal; decisão 235): abre em Enviar convites. */
  deliveries: '/app/envios',
  /**
   * Envios › Enviar convites, Save the date e Lembrar pendentes (decisão 235): as etapas
   * (Grupos → Canal e mensagem → Fila) no mesmo caminho, com ?etapa=canal e ?etapa=fila.
   */
  deliveryInvites: '/app/envios/convites',
  deliverySaveTheDate: '/app/envios/save-the-date',
  deliveryReminder: '/app/envios/lembrete',
  /** Envios › Prazo de resposta (Prazo e respostas RN02; decisão 217(13)). */
  deliveryDeadline: '/app/envios/prazo',
  /**
   * Músicas (Música RN05): só com a pergunta de música ligada; desligada, leva ao Editor ›
   * Pergunta de música (RN03).
   */
  songs: '/app/musicas',
  /** Notificações (Central RN06; decisão 217(13)): o sino da Topbar leva aqui. */
  notifications: '/app/notificacoes',
  /** Configurações › Notificações (Central RN07; decisão 221). */
  settingsNotifications: '/app/configuracoes/notificacoes',
  /** Site › Editor (decisão 214): /app/site abre os Dados básicos. */
  site: '/app/site',
  siteSection: '/app/site/:section',
  /**
   * Cobrança e publicação › Publicar o site (Publicação por Cortesia RN07; decisão 217(13)).
   * Sem item na Sidebar na F4 (decisão 228(2)): abre pelo Publicar do Editor e do Dashboard.
   */
  publish: '/app/cobranca/publicar',
} as const;

/** Caminho do Painel de um grupo. */
export function guestPartyPath({ partyId }: { partyId: string }) {
  return paths.guestParty.replace(':partyId', encodeURIComponent(partyId));
}

export function guestPartyEditPath({ partyId }: { partyId: string }) {
  return paths.guestPartyEdit.replace(':partyId', encodeURIComponent(partyId));
}

/** Endereços fora do app. */
export const externalUrls = {
  /** "Fazer parceria" na F0 (decisões 150(4) e 157(4)); na F6, o cadastro do cerimonialista. */
  plannerPartnership: 'https://kore.com.br/cerimonialistas',
} as const;

export function siteSectionPath({ section }: { section: string }) {
  return paths.siteSection.replace(':section', encodeURIComponent(section));
}
