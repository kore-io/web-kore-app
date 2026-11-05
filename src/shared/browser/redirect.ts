/** Sai do app para outro endereço (login com Google, páginas do site). */
export function redirectTo({ url }: { url: string }) {
  window.location.assign(url);
}
