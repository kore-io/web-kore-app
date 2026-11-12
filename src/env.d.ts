interface ImportMetaEnv {
  /** Endereço da API, sem barra no fim (ex.: http://localhost:3000). */
  readonly VITE_API_URL: string;
  /**
   * A linha da empresa no rodapé do site do casal (Site público RN10; decisão 123 D9).
   * Vazios, a linha não aparece.
   */
  readonly VITE_COMPANY_NAME?: string;
  readonly VITE_COMPANY_CNPJ?: string;
  readonly VITE_COMPANY_ADDRESS?: string;
  /** O Simule em kore.com.br/simule (Simule RN01): "true" só no local, até o PO liberar. */
  readonly VITE_SIMULATOR_ENABLED?: string;
  /** O endereço do app, para os botões do Pronto do Simule (RN08; ex.: http://localhost:5173). */
  readonly VITE_APP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
