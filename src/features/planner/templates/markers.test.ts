import { describe, expect, it } from 'vitest';
import { applyMarkers, coupleFirstNames } from './markers';

const data = {
  partnerNames: ['Ana Beatriz', 'Marcos Vinícius'],
  eventDate: '2026-11-14',
  city: 'Campinas',
};

describe('Modelos › os marcadores (RN07)', () => {
  it('troca {casal}, {data} e {cidade}', () => {
    expect(applyMarkers({ text: '{casal} se casam em {data}, em {cidade}.', data })).toEqual({
      text: 'Ana e Marcos se casam em 14 de novembro de 2026, em Campinas.',
      missingDate: false,
    });
  });

  it('a data não muda de dia em nenhum fuso (a data sem hora)', () => {
    expect(applyMarkers({ text: '{data}', data: { ...data, eventDate: '2026-01-01' } }).text).toBe(
      '1 de janeiro de 2026',
    );
  });

  it('sem a data, o marcador fica à vista e avisa', () => {
    expect(applyMarkers({ text: 'Dia {data}.', data: { ...data, eventDate: null } })).toEqual({
      text: 'Dia {data}.',
      missingDate: true,
    });
  });

  it('passada única: o valor com um marcador não é trocado de novo', () => {
    expect(
      applyMarkers({
        text: '{casal} em {cidade}',
        data: { ...data, partnerNames: ['{cidade}', 'João'] },
      }).text,
    ).toBe('{cidade} e João em Campinas');
  });

  it('o valor entra como texto simples, e outras chaves ficam', () => {
    expect(
      applyMarkers({
        text: '{casal} {noivos}',
        data: { ...data, partnerNames: ['<b>Ana</b>', 'Marcos'] },
      }).text,
    ).toBe('<b>Ana</b> e Marcos {noivos}');
  });

  it('os primeiros nomes, sem espaços sobrando', () => {
    expect(coupleFirstNames(['  Ana  Beatriz ', 'Marcos'])).toBe('Ana e Marcos');
  });
});
