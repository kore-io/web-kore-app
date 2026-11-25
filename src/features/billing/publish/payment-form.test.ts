import { describe, expect, it } from 'vitest';
import {
  cvvState,
  expiryState,
  formatCardNumber,
  formatCpf,
  formatExpiry,
  isValidCardNumber,
  isValidCpf,
  localCardToken,
} from './payment-form';

describe('o CPF de quem paga (RN02)', () => {
  it('a máscara enquanto se digita', () => {
    expect(formatCpf('529')).toBe('529');
    expect(formatCpf('5299822')).toBe('529.982.2');
    expect(formatCpf('52998224725')).toBe('529.982.247-25');
    expect(formatCpf('529.982.247-2599')).toBe('529.982.247-25');
  });

  it('os dígitos verificadores', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCpf('529.982.247-24')).toBe(false);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('529.982.247')).toBe(false);
  });
});

describe('o cartão (RN03; Pena, item 5)', () => {
  it('o número em grupos de 4 e o Luhn', () => {
    expect(formatCardNumber('4111111111111111')).toBe('4111 1111 1111 1111');
    expect(isValidCardNumber('4111 1111 1111 1111')).toBe(true);
    expect(isValidCardNumber('4111 1111 1111 1112')).toBe(false);
    expect(isValidCardNumber('4111 1111')).toBe(false);
  });

  it('a validade: o formato, o mês e o vencimento (vale até o fim do mês)', () => {
    const now = new Date(2026, 10, 24);
    expect(formatExpiry('0829')).toBe('08/29');
    expect(expiryState({ value: '', now })).toBe('empty');
    expect(expiryState({ value: '08/2', now })).toBe('format');
    expect(expiryState({ value: '13/29', now })).toBe('format');
    expect(expiryState({ value: '10/26', now })).toBe('expired');
    expect(expiryState({ value: '11/26', now })).toBe('ok');
    expect(expiryState({ value: '08/29', now })).toBe('ok');
  });

  it('o CVV com 3 ou 4 números (318(2))', () => {
    expect(cvvState('')).toBe('empty');
    expect(cvvState('12')).toBe('size');
    expect(cvvState('123')).toBe('ok');
    expect(cvvState('1234')).toBe('ok');
    expect(cvvState('12345')).toBe('size');
  });

  it('o token do adaptador local termina nos 4 últimos números (316(4))', () => {
    expect(localCardToken({ number: '4111 1111 1111 0002' })).toBe('local_card_0002');
  });
});
