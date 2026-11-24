/**
 * Dinheiro nas telas (convenção 4 de .prs/f3/textos-f3.md; Voz & Microcopy): o valor vem da
 * API em centavos inteiros, e o navegador só mostra (decisão 230, risco 4).
 */
const WITH_CENTS = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const WHOLE = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

/** Espaço sem quebra depois do "R$"; o sinal de menos tipográfico antes ("−R$ 10,11"). */
const NBSP = ' ';
const MINUS = '−';

function withSign({ cents, digits }: { cents: number; digits: string }) {
  return `${cents < 0 ? MINUS : ''}R$${NBSP}${digits}`;
}

/**
 * Valor de um pagamento (linhas do Resumo, totais, parcelas, reembolsos, comissões, saldos):
 * sempre com os centavos e o ponto no milhar, "R$ 1.234,56"; negativo, "−R$ 10,11".
 */
export function formatCents({ cents }: { cents: number }): string {
  return withSign({ cents, digits: WITH_CENTS.format(Math.abs(cents) / 100) });
}

/**
 * Preço de regra numa frase ("R$ 29 por mês", "a partir de R$ 50"): sem os centavos quando
 * o valor é inteiro em reais; com os centavos, quando não é ("R$ 17,40").
 */
export function formatRulePrice({ cents }: { cents: number }): string {
  return Math.abs(cents) % 100 === 0
    ? withSign({ cents, digits: WHOLE.format(Math.abs(cents) / 100) })
    : formatCents({ cents });
}
