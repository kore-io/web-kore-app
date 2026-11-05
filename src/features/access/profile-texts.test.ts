import { describe, expect, it } from 'vitest';
import { i18n } from '../../shared/i18n/i18n';
import {
  formatWeddingDate,
  plannerProfileDescription,
  weddingProfileDescription,
} from './profile-texts';

const t = i18n.getFixedT('pt-BR', 'access');

describe('textos dos cartões de perfil (Voz; decisão 152)', () => {
  it('data do casamento no formato da Voz', () => {
    expect(formatWeddingDate({ isoDate: '2027-03-20' })).toBe('sáb., 20 de mar. de 2027');
  });

  it('casamento: data e cidade; só a cidade; "Data a definir"', () => {
    expect(
      weddingProfileDescription({ t, isoDate: '2027-03-20', city: 'Valinhos', state: 'SP' }),
    ).toBe('sáb., 20 de mar. de 2027 · Valinhos (SP)');
    expect(weddingProfileDescription({ t, city: 'Valinhos', state: 'SP' })).toBe('Valinhos (SP)');
    expect(weddingProfileDescription({ t })).toBe('Data a definir');
  });

  it.each([
    [12, 'Prado Assessoria · 12 casamentos'],
    [1, 'Prado Assessoria · 1 casamento'],
    [0, 'Prado Assessoria · Nenhum casamento ainda'],
  ])('cerimonialista com %i casamentos', (weddingCount, text) => {
    expect(plannerProfileDescription({ t, organization: 'Prado Assessoria', weddingCount })).toBe(
      text,
    );
  });
});
