import i18next from 'i18next';
import { describe, expect, it } from 'vitest';
import { deliveryStatusText, hasLinkPlaceholder, needsLink, sentAtOf } from './delivery-texts';

const t = i18next.getFixedT('pt-BR', 'deliveries');
const now = new Date(2026, 8, 14, 18, 0);

describe('os textos da fila de envio (Envios RN03, RN06, RN07)', () => {
  it('o status no cartão: hoje, outro dia, por canal e a mensagem copiada', () => {
    const today = new Date(2026, 8, 14, 10, 42).toISOString();
    const other = new Date(2026, 8, 2, 10, 42).toISOString();
    expect(deliveryStatusText({ t, at: today, channel: 'whatsapp', now })).toBe(
      'Enviado às 10h42 pelo WhatsApp',
    );
    expect(deliveryStatusText({ t, at: other, channel: 'whatsapp', now })).toBe(
      'Enviado em 02/09 às 10h42 pelo WhatsApp',
    );
    expect(deliveryStatusText({ t, at: today, channel: 'email', now })).toBe(
      'Enviado às 10h42 por e-⁠mail',
    );
    expect(deliveryStatusText({ t, at: today, channel: 'link', now })).toBe(
      'Mensagem copiada às 10h42',
    );
    expect(deliveryStatusText({ t, at: other, channel: 'link', now })).toBe(
      'Mensagem copiada em 02/09 às 10h42',
    );
    expect(
      deliveryStatusText({
        t,
        at: new Date(2026, 8, 14, 9, 0).toISOString(),
        channel: 'whatsapp',
        now,
      }),
    ).toBe('Enviado às 9h pelo WhatsApp');
    expect(deliveryStatusText({ t, at: null, channel: 'whatsapp', now })).toBeNull();
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
