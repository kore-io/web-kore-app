import '@testing-library/jest-dom/vitest';
import '../src/shared/i18n/i18n';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

// O jsdom não tem o <dialog> modal: abrir e fechar mudam o atributo `open`, como no navegador.
// Só no jsdom: testes em ambiente node (ex.: o modelo da planilha) não têm DOM.
const hasDom = typeof window !== 'undefined';

if (hasDom && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}

/** IntersectionObserver de mentira: o teste chama `intersect()` para simular a rolagem. */
export const intersectionObservers: { callback: IntersectionObserverCallback }[] = [];
class FakeIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    intersectionObservers.push({ callback });
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
if (hasDom && !('IntersectionObserver' in window)) {
  Object.assign(window, { IntersectionObserver: FakeIntersectionObserver });
}

/** Simula o marcador do fim da lista entrando na tela. */
export function intersect() {
  for (const { callback } of intersectionObservers) {
    callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
  }
}
