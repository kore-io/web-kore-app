import { createContext, useContext, useMemo, type ReactNode } from 'react';

/**
 * A área em que as telas do casamento estão montadas (Colaboradora RN01 e RN09; decisões
 * 223 D2 e 224): a do casal em `/app`, com o casamento de dono, e a da colaboradora em
 * `/cerimonialista/casamentos/:weddingId`, com o casamento da rota. As mesmas telas
 * servem às duas; os links internos usam o caminho-base da área.
 */
export interface Area {
  /** O caminho-base, sem a barra final: `/app` ou `/cerimonialista/casamentos/{id}`. */
  base: string;
  /** O casamento da rota (na área da colaboradora); na do casal, vem do `/me`. */
  weddingId?: string;
  /** Quem a área serve: a versão dos textos segue a área, não o perfil ativo. */
  kind: 'couple' | 'planner';
}

export const COUPLE_AREA: Area = { base: '/app', kind: 'couple' };

const AreaContext = createContext<Area>(COUPLE_AREA);

export function AreaProvider({ area, children }: { area: Area; children: ReactNode }) {
  return <AreaContext.Provider value={area}>{children}</AreaContext.Provider>;
}

export function useArea(): Area {
  return useContext(AreaContext);
}

/** O caminho da área da colaboradora de um casamento. */
export function plannerWeddingBase({ weddingId }: { weddingId: string }): string {
  return `/cerimonialista/casamentos/${encodeURIComponent(weddingId)}`;
}

/**
 * Os caminhos das telas do casamento (decisões 198, 214, 217(13), 221 e 235) a partir do
 * caminho-base. Os de envio levam as etapas na query (`?etapa=canal`, `?etapa=fila`).
 */
export function areaPaths(base: string) {
  return {
    /** O Dashboard é a raiz da área. */
    dashboard: base,
    /** Convidados › Grupos e convidados; busca e filtros na query. */
    guests: `${base}/convidados`,
    guestImport: `${base}/convidados/importar`,
    guestExport: `${base}/convidados/exportar`,
    guestTags: `${base}/convidados/tags`,
    guestTrash: `${base}/convidados/lixeira`,
    /** Novo grupo e Editar grupo (decisão 213(9)). */
    guestNew: `${base}/convidados/novo`,
    /** Envios: abre em Enviar convites (decisão 235). */
    deliveries: `${base}/envios`,
    deliveryInvites: `${base}/envios/convites`,
    deliverySaveTheDate: `${base}/envios/save-the-date`,
    deliveryReminder: `${base}/envios/lembrete`,
    /** Envios › Prazo de resposta (decisão 217(13)). */
    deliveryDeadline: `${base}/envios/prazo`,
    /** Músicas, só com a pergunta ligada (Música RN03 e RN05). */
    songs: `${base}/musicas`,
    /** Notificações, pelo sino da Topbar (decisão 217(13)). */
    notifications: `${base}/notificacoes`,
    /** Configurações › Notificações (decisão 221). */
    settingsNotifications: `${base}/configuracoes/notificacoes`,
    /** Site › Editor (decisão 214): abre os Dados básicos. */
    site: `${base}/site`,
    /** O Painel de um grupo: link próprio, para compartilhar e para o voltar (198). */
    guestParty: ({ partyId }: { partyId: string }) =>
      `${base}/convidados/grupos/${encodeURIComponent(partyId)}`,
    guestPartyEdit: ({ partyId }: { partyId: string }) =>
      `${base}/convidados/grupos/${encodeURIComponent(partyId)}/editar`,
    /** Uma seção do Editor do site, pelo caminho dela (214). */
    siteSection: ({ section }: { section: string }) =>
      `${base}/site/${encodeURIComponent(section)}`,
  };
}

export type AreaPaths = ReturnType<typeof areaPaths>;

/** Os caminhos da área em que a tela está. */
export function useAreaPaths(): AreaPaths {
  const { base } = useArea();
  return useMemo(() => areaPaths(base), [base]);
}
