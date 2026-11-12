/** Sai do app para outro endereço (login com Google, páginas do site). */
export function redirectTo({ url }: { url: string }) {
  window.location.assign(url);
}

/** Recarrega a página (ex.: o app desatualizado busca a versão nova, decisão 169(1)). */
export function reloadPage() {
  window.location.reload();
}
