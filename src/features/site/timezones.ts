import type { BrazilState } from '../../shared/brazil-states';

/**
 * O fuso só leitura dos Dados básicos (RN02; textos-f2): sem o nome IANA. As UFs a −4 h
 * (MT, MS, AM, RO e RR) e a −5 h (AC); as outras, no horário de Brasília. A tabela da UF
 * para o fuso é a do Cadastro (RN03), que a API aplica ao gravar.
 */
const MINUS_ONE: readonly BrazilState[] = ['MT', 'MS', 'AM', 'RO', 'RR'];

export function timezoneLabelKey(state: string | null): 'brasilia' | 'minus1' | 'minus2' | null {
  if (!state) return null;
  if (state === 'AC') return 'minus2';
  return MINUS_ONE.includes(state as BrazilState) ? 'minus1' : 'brasilia';
}
