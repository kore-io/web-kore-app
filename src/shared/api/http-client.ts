/** Endereço da API (ex.: http://localhost:3000); vem do VITE_API_URL. */
const API_URL = import.meta.env.VITE_API_URL;

/** Endereço completo de um caminho da API (ex.: o início do login com Google). */
export function apiUrl({ path }: { path: string }) {
  return `${API_URL}${path}`;
}

/** Resposta de erro da API: o status e o corpo (`error` é o código, ex.: TOO_SOON). */
export class ApiError<TBody = unknown> extends Error {
  readonly status: number;
  readonly body: TBody;

  constructor({ status, body }: { status: number; body: TBody }) {
    super(`API respondeu ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/** Tipo do erro dos hooks gerados pelo Orval: o ApiError com o corpo de erro da rota. */
export type ErrorType<TBody> = ApiError<TBody>;

type Listener = () => void;
const weddingBlockedListeners = new Set<Listener>();

/**
 * Avisa quando uma resposta da API traz o `403 WEDDING_BLOCKED` (Bloqueado RN07), venha ela
 * de um hook ou de uma chamada direta. Devolve a função que desliga o aviso.
 */
export function onWeddingBlocked(listener: Listener): () => void {
  weddingBlockedListeners.add(listener);
  return () => {
    weddingBlockedListeners.delete(listener);
  };
}

/** Código do erro no corpo da API (`error`), quando houver. */
export function apiErrorCode({ error }: { error: unknown }): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  const body: unknown = error.body;
  if (typeof body === 'object' && body !== null && 'error' in body) {
    return typeof body.error === 'string' ? body.error : undefined;
  }
  return undefined;
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Mutator do Orval: fetch com o cookie de sessão (`credentials: 'include'`; o app e a API
 * ficam em subdomínios do mesmo site, SameSite=Lax) e erro tipado em ApiError.
 */
export async function httpClient<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(apiUrl({ path }), {
    ...init,
    credentials: 'include',
    headers: { Accept: 'application/json', ...init.headers },
  });
  const body = await readBody(response);
  if (!response.ok) {
    const error = new ApiError({ status: response.status, body });
    if (apiErrorCode({ error }) === 'WEDDING_BLOCKED') {
      weddingBlockedListeners.forEach((listener) => listener());
    }
    throw error;
  }
  return body as T;
}
