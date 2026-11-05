import type { MeUserResponse } from '../../shared/api/generated/model';

/**
 * A pessoa conectada como o Menu do usuário mostra (decisão 163(3)): sem nome (conta
 * nova), o e-mail ocupa o lugar do nome e a inicial vem da primeira letra do e-mail.
 */
export function menuUser({ user }: { user: MeUserResponse }) {
  const name = user.name?.trim();
  if (!name) {
    return { name: user.email, email: user.email, initials: user.email.charAt(0).toUpperCase() };
  }
  const words = name.split(/\s+/);
  const first = words[0]?.charAt(0) ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.charAt(0) ?? '') : '';
  return { name, email: user.email, initials: `${first}${last}`.toUpperCase() };
}
