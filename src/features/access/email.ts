const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Conferência local do e-mail antes de chamar a API (a API valida de novo). */
export function isValidEmail({ email }: { email: string }) {
  return EMAIL_PATTERN.test(email);
}
