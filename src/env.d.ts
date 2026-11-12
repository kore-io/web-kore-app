interface ImportMetaEnv {
  /** Endereço da API, sem barra no fim (ex.: http://localhost:3000). */
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
