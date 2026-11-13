import i18next from 'i18next';
import { describe, expect, it } from 'vitest';
import { deliveryStatusText, hasLinkPlaceholder, needsLink, sentAtOf } from './delivery-texts';

const t = i18next.getFixedT('pt-BR', 'deliveries');
const SP = 'America/Sao_Paulo';
// 18h de 14/09 em São Paulo.
const now = new Date('2026-09-14T21:00:00Z');

describe('os textos da fila de envio (Envios RN03, RN06, RN07)', () => {
  it('o status no cartão: hoje, outro dia, por canal e a mensagem copiada', () => {
    const today = '2026-09-14T13:42:00Z';
    const other = '2026-09-02T13:42:00Z';
    expect(deliveryStatusText({ t, at: today, channel: 'whatsapp', now, timezone: SP })).toBe(
      'Enviado às 10h42 pelo WhatsApp',
    );
    expect(deliveryStatusText({ t, at: other, channel: 'whatsapp', now, timezone: SP })).toBe(
      'Enviado em 02/09 às 10h42 pelo WhatsApp',
    );
    expect(deliveryStatusText({ t, at: today, channel: 'email', now, timezone: SP })).toBe(
      'Enviado às 10h42 por e-⁠mail',
    );
    expect(deliveryStatusText({ t, at: today, channel: 'link', now, timezone: SP })).toBe(
      'Mensagem copiada às 10h42',
    );
    expect(deliveryStatusText({ t, at: other, channel: 'link', now, timezone: SP })).toBe(
      'Mensagem copiada em 02/09 às 10h42',
    );
    expect(
      deliveryStatusText({
        t,
        at: '2026-09-14T12:00:00Z',
        channel: 'whatsapp',
        now,
        timezone: SP,
      }),
    ).toBe('Enviado às 9h pelo WhatsApp');
    expect(deliveryStatusText({ t, at: null, channel: 'whatsapp', now, timezone: SP })).toBeNull();
  });

  it('a hora e o "hoje" no fuso do casamento, não no do aparelho (decisão 248)', () => {
    // 22h30 de 13/09 em São Paulo é 01h30 de 14/09 em UTC: para o casamento, foi ontem.
    const lateNight = '2026-09-14T01:30:00Z';
    expect(deliveryStatusText({ t, at: lateNight, channel: 'whatsapp', now, timezone: SP })).toBe(
      'Enviado em 13/09 às 22h30 pelo WhatsApp',
    );
    // Em Manaus, uma hora antes.
    expect(
      deliveryStatusText({
        t,
        at: '2026-09-14T13:42:00Z',
        channel: 'email',
        now,
        timezone: 'America/Manaus',
      }),
    ).toBe('Enviado às 9h42 por e-\u2060mail');
  });

  it('a hora do envio por tipo e o {link} obrigatório no convite e no lembrete', () => {
    const item = { sentAt: 'a', saveTheDateSentAt: 'b', lastReminderAt: 'c' };
    expect(sentAtOf({ kind: 'invite', item })).toBe('a');
    expect(sentAtOf({ kind: 'save_the_date', item })).toBe('b');
    expect(sentAtOf({ kind: 'reminder', item })).toBe('c');
    expect(needsLink('invite')).toBe(true);
    expect(needsLink('reminder')).toBe(true);
    expect(needsLink('save_the_date')).toBe(false);
    expect(hasLinkPlaceholder('Confirme: {link}')).toBe(true);
    expect(hasLinkPlaceholder('Confirme: link')).toBe(false);
  });
});
