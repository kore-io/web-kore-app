import { AccessLayout } from './access-layout';

/** Quadro de acesso vazio enquanto o app confere o login (decisão 157(5)): sem texto. */
export function AccessPending() {
  return (
    <AccessLayout>
      <div className="kore-sign-in" aria-busy="true" />
    </AccessLayout>
  );
}
