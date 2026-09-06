import { clerkMiddleware } from '@clerk/nextjs/server';

const publishableKey =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??
  process.env.VITE_CLERK_PUBLISHABLE_KEY;

// Local development can run without a Clerk application. Hosted environments
// still use Clerk whenever credentials are configured.
export default publishableKey
  ? clerkMiddleware({ publishableKey })
  : () => undefined;

export const config = {
  matcher: [
    '/',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/(api|trpc)(.*)',
    '/__clerk/:path*',
  ],
};
