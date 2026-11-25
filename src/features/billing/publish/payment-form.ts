/**
 * O formulário do pagar no Publicar (Publicar e pagar RN02 e RN03; Pena, item 5; decisão
 * 318(2)): as máscaras e as conferências do CPF de quem paga e do cartão, antes de mandar.
 * O servidor confere de novo (o CPF dá `400`); aqui é só para o casal ver o erro no campo.
 */

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/** "529.982.247-25", montado enquanto se digita (até 11 números). */
export function formatCpf(value: string): string {
  const digits = digitsOnly(value).slice(0, 11);
  const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9)].filter(Boolean);
  const head = parts.join('.');
  return digits.length > 9 ? `${head}-${digits.slice(9)}` : head;
}

/** O CPF com os dois dígitos verificadores certos (e não os 11 números iguais). */
export function isValidCpf(value: string): boolean {
  const digits = digitsOnly(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const check = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * (length + 1 - index);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
}

/** "0000 0000 0000 0000", em grupos de 4 (até 19 números). */
export function formatCardNumber(value: string): string {
  return (
    digitsOnly(value)
      .slice(0, 19)
      .match(/.{1,4}/g)
      ?.join(' ') ?? ''
  );
}

/** O número do cartão: de 13 a 19 números, com o dígito de Luhn certo. */
export function isValidCardNumber(value: string): boolean {
  const digits = digitsOnly(value);
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    let digit = Number(digits[digits.length - 1 - index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/** "MM/AA", montado enquanto se digita. */
export function formatExpiry(value: string): string {
  const digits = digitsOnly(value).slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

export type ExpiryState = 'empty' | 'format' | 'expired' | 'ok';

/**
 * A validade: vazia; fora do formato (mês de 01 a 12 e ano com dois números); vencida (o
 * cartão vale até o fim do mês); ou certa.
 */
export function expiryState({ value, now }: { value: string; now: Date }): ExpiryState {
  const digits = digitsOnly(value);
  if (digits.length === 0) return 'empty';
  if (digits.length !== 4) return 'format';
  const month = Number(digits.slice(0, 2));
  const year = 2000 + Number(digits.slice(2));
  if (month < 1 || month > 12) return 'format';
  const endOfMonth = new Date(year, month, 1);
  return endOfMonth <= now ? 'expired' : 'ok';
}

export type CvvState = 'empty' | 'size' | 'ok';

/** O CVV: 3 ou 4 números (o Amex tem 4, na frente; decisão 318(2)). */
export function cvvState(value: string): CvvState {
  const digits = digitsOnly(value);
  if (digits.length === 0) return 'empty';
  return digits.length === 3 || digits.length === 4 ? 'ok' : 'size';
}

/**
 * O `cardToken` do adaptador local (decisão 316(4)): os dados do cartão não passam pelo
 * Kore (RN03), e no local o token é feito dos 4 últimos números; o final 0002 é o cartão de
 * teste recusado. A tokenização do gateway de verdade fica com o card 65 (Asaas, B2-16).
 */
export function localCardToken({ number }: { number: string }): string {
  return `local_card_${digitsOnly(number).slice(-4)}`;
}
