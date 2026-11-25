import type { BillingQuoteResponse, PricingResponse } from '../../../shared/api/generated/model';

/**
 * O que a tela do Publicar mostra a partir da cotação do servidor (Preço e cotação RN01,
 * RN04 e RN09). O servidor é a fonte do preço e o navegador só mostra (decisão 230, risco
 * 4): aqui não há fórmula de preço, só a divisão das parcelas pela regra da RN01 (o total
 * div n, com a diferença de centavos na 1ª) sobre os totais que a API devolveu.
 */

/** As parcelas de um total: a 1ª leva a diferença de centavos (RN01; decisão 231, B1-1). */
export function installmentSplit({ totalCents, count }: { totalCents: number; count: number }) {
  const rest = Math.floor(totalCents / count);
  return { first: rest + (totalCents % count), rest };
}

export interface InstallmentOption {
  count: number;
  /** O total pago nesta parcela (com juros acima do limite sem juros). */
  totalCents: number;
  first: number;
  rest: number;
  withInterest: boolean;
}

/**
 * As opções do Select de Parcelas (RN09): até `interestFreeUpTo`, o total do cartão sem
 * juros (`totalsByMethod.cardUpTo6`); acima, o total com juros, que é o mesmo de 7x a 12x
 * (RN01) e vem de uma 2ª cotação com installments=7 (decisão 322). Sem esse total ainda,
 * as opções com juros não aparecem. O máximo é o `maxInstallments` da cotação.
 */
export function installmentOptions({
  maxInstallments,
  interestFreeUpTo,
  cardWithoutInterestCents,
  cardWithInterestCents,
}: {
  maxInstallments: number;
  interestFreeUpTo: number;
  cardWithoutInterestCents: number;
  cardWithInterestCents: number | null;
}): InstallmentOption[] {
  const options: InstallmentOption[] = [];
  for (let count = 1; count <= maxInstallments; count += 1) {
    const withInterest = count > interestFreeUpTo;
    const totalCents = withInterest ? cardWithInterestCents : cardWithoutInterestCents;
    if (totalCents === null) break;
    options.push({ count, totalCents, withInterest, ...installmentSplit({ totalCents, count }) });
  }
  return options;
}

/**
 * O "a partir de N meses" da legenda do teto (RN09): o menor número de meses em que o preço
 * de tabela (ativação + meses × mês) passa do preço máximo. Sai dos valores do
 * `GET /v1/pricing`, sem número fixo no código.
 */
export function capStartsAtMonths({ pricing }: { pricing: PricingResponse }): number {
  const { activationCents, monthlyCents, capCents } = pricing;
  return Math.floor((capCents - activationCents) / monthlyCents) + 1;
}

export type SummaryRow =
  | { kind: 'activation'; cents: number }
  | { kind: 'months'; months: number; cents: number }
  | { kind: 'cap'; cents: number }
  | { kind: 'referral'; label: 'assessoria' | 'indicacao'; cents: number }
  | { kind: 'pix'; cents: number }
  | { kind: 'interest'; installments: number; cents: number };

/**
 * As linhas do Resumo, na ordem da RN09, a partir da cotação. Os descontos vão negativos
 * (o "−R$" do Penpot); o teto, o desconto de indicação, o do Pix e os juros só aparecem
 * quando a cotação os traz. Sem a data escolhida (cotação só com os limites), nenhuma.
 */
export function summaryRows({ quote }: { quote: BillingQuoteResponse }): SummaryRow[] {
  const {
    activationListCents,
    listTotalCents,
    monthsCovered,
    capDiscountCents,
    referralDiscountCents,
    referralLabel,
    pixDiscountCents,
    installmentInterestCents,
    installments,
  } = quote;
  if (activationListCents === null || listTotalCents === null || monthsCovered === null) return [];
  const rows: SummaryRow[] = [
    { kind: 'activation', cents: activationListCents },
    { kind: 'months', months: monthsCovered, cents: listTotalCents - activationListCents },
  ];
  if (capDiscountCents) rows.push({ kind: 'cap', cents: -capDiscountCents });
  if (referralDiscountCents && referralLabel) {
    rows.push({ kind: 'referral', label: referralLabel, cents: -referralDiscountCents });
  }
  if (pixDiscountCents) rows.push({ kind: 'pix', cents: -pixDiscountCents });
  if (installmentInterestCents && installments) {
    rows.push({ kind: 'interest', installments, cents: installmentInterestCents });
  }
  return rows;
}

/** "3,99%": o percentual dos juros, só para mostrar (o `interestPercent` do pricing). */
export function percentText({ percent }: { percent: number }): string {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(percent)}%`;
}

/** A data escolhida está dentro dos limites da cotação (AAAA-MM-DD compara como texto). */
export function isEndDateInRange({
  endDate,
  min,
  max,
}: {
  endDate: string;
  min: string | null;
  max: string;
}): boolean {
  return (min === null || endDate >= min) && endDate <= max;
}
