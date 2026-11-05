import { useSearchParams } from 'react-router';
import { AccessPending } from '../components/access-pending';
import { useGoogleReturn } from '../hooks/use-google-return';

/** /entrar/google?step=&next=: a volta do login com Google (decisão 147). */
export function SignInGooglePage() {
  const [searchParams] = useSearchParams();
  useGoogleReturn({ step: searchParams.get('step'), next: searchParams.get('next') });
  return <AccessPending />;
}
