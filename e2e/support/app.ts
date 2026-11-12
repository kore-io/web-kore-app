import { expect, type Page } from '@playwright/test';

/**
 * O Toast visível, dentro da região de avisos: o Radix também cria, por 1 s, uma cópia
 * escondida do texto para o leitor de tela, fora da região.
 */
export function toast({ page, text }: { page: Page; text: string }) {
  return page.getByRole('region', { name: /^Avisos/ }).getByText(text);
}
/** Entra pelo provedor dev do Google (decisão 147) e espera a área do casal. */
export async function signIn({ page, email }: { page: Page; email: string }) {
  await page.goto('/entrar');
  await page.getByRole('button', { name: 'Continuar com Google' }).click();
  await page.getByLabel('E-mail').fill(email);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/(app|perfis)$/);
  // A navegação que fecha o login termina antes de o teste ir para outra página.
  await page.waitForLoadState('networkidle');
}
