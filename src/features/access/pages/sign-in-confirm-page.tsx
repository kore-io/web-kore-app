import { useSearchParams } from 'react-router';
import { AccessPending } from '../components/access-pending';
import { useConfirmSignIn } from '../hooks/use-confirm-sign-in';

/** /entrar/confirmar?token=: o botão do e-mail de código (decisão 139). */
export function SignInConfirmPage() {
  const [searchParams] = useSearchParams();
  useConfirmSignIn({ token: searchParams.get('token') });
  return <AccessPending />;
}
