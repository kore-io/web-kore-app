import i18next from 'i18next';
import { describe, expect, it } from 'vitest';
import { countdownText, previewDateLine, savedAtText, siteStatus, todayIn } from './site-texts';

const t = i18next.getFixedT('pt-BR', 'site');

describe('textos do Editor do site', () => {
  it('"salvo às 10h31" no fuso do casamento; com minuto zero, "salvo às 10h" (RN10)', () => {
    const tz = 'America/Sao_Paulo';
    expect(savedAtText({ t, at: '2026-11-11T13:31:00Z', timezone: tz })).toBe('salvo às 10h31');
    expect(savedAtText({ t, at: '2026-11-11T13:00:00Z', timezone: tz })).toBe('salvo às 10h');
    expect(savedAtText({ t, at: '2026-11-11T12:05:00Z', timezone: tz })).toBe('salvo às 9h05');
    // Em Rio Branco (−5 h), a mesma gravação é 8h31.
    expect(savedAtText({ t, at: '2026-11-11T13:31:00Z', timezone: 'America/Rio_Branco' })).toBe(
      'salvo às 8h31',
    );
    expect(savedAtText({ t, at: null, timezone: tz })).toBeNull();
  });

  it('o status do casamento vira o selo; o desconhecido, nada', () => {
    expect(siteStatus('draft')).toBe('draft');
    expect(siteStatus('grace')).toBeNull();
  });

  it('a contagem conta no fuso do casamento (Seções RN06)', () => {
    // 23h30 de 13/11 em São Paulo já é 14/11 em UTC: ainda falta 1 dia.
    const now = new Date('2026-11-14T02:30:00Z');
    expect(todayIn({ timezone: 'America/Sao_Paulo', now })).toBe('2026-11-13');
    expect(countdownText({ t, eventDate: '2026-11-14', timezone: 'America/Sao_Paulo', now })).toBe(
      'Falta 1 dia',
    );
    expect(countdownText({ t, eventDate: '2026-12-31', timezone: 'America/Sao_Paulo', now })).toBe(
      'Faltam 48 dias',
    );
    expect(countdownText({ t, eventDate: '2026-11-13', timezone: 'America/Sao_Paulo', now })).toBe(
      'É hoje',
    );
    expect(
      countdownText({ t, eventDate: '2026-11-12', timezone: 'America/Sao_Paulo', now }),
    ).toBeNull();
    expect(countdownText({ t, eventDate: null, timezone: null, now })).toBeNull();
  });

  it('a linha de data e cidade da prévia, sem a parte que falta', () => {
    expect(previewDateLine({ eventDate: '2026-11-14', city: 'Campinas' })).toBe(
      'sábado, 14 de novembro de 2026 · Campinas',
    );
    expect(previewDateLine({ eventDate: null, city: 'Campinas' })).toBe('Campinas');
    expect(previewDateLine({ eventDate: null, city: null })).toBeNull();
  });
});
