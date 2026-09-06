import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

// Preserve the existing API contract while Clerk supplies verified identity.
export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const hasClerk = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??
      process.env.VITE_CLERK_PUBLISHABLE_KEY,
  );
  if (!hasClerk && process.env.NODE_ENV === 'development') {
    return {
      userId: 'local-development-user',
      displayName: 'Local user',
      email: 'local@jeoils.test',
      fullName: 'Local user',
    };
  }
  if (!hasClerk) return null;
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  const email = user?.primaryEmailAddress;
  if (!user || !email || email.verification?.status !== 'verified') return null;
  return {
    userId,
    displayName: user.fullName ?? email.emailAddress,
    email: email.emailAddress,
    fullName: user.fullName,
  };
}

export async function requireChatGPTUser(_returnTo: string): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (!user) redirect('/');
  return user;
}

export function chatGPTSignInPath(_returnTo: string): string { return '/'; }
export function chatGPTSignOutPath(_returnTo = '/'): string { return '/'; }
