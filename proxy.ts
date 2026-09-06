import { clerkMiddleware } from '@clerk/nextjs/server';

export default clerkMiddleware({
  publishableKey:
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??
    process.env.VITE_CLERK_PUBLISHABLE_KEY,
});

export const config = {
  matcher: [
    '/',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/(api|trpc)(.*)',
    '/__clerk/:path*',
  ],
};
