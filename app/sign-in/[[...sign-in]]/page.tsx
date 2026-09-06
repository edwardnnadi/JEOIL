import { SignIn } from '@clerk/nextjs';
import { AuthShell } from '../../auth-shell';

export default function SignInPage() {
  return (
    <AuthShell>
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/"
      />
    </AuthShell>
  );
}
