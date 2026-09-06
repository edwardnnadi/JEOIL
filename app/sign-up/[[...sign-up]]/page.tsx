import { SignUp } from '@clerk/nextjs';
import { AuthShell } from '../../auth-shell';

export default function SignUpPage() {
  return (
    <AuthShell registering>
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/"
      />
    </AuthShell>
  );
}
