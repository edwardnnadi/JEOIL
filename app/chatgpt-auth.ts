import { headers } from 'next/headers';

export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

const ACCESS_JWT_HEADER = 'cf-access-jwt-assertion';

/**
 * Cloudflare Access authenticates the visitor before forwarding the request to
 * this Worker and adds a signed identity JWT. The app runs only on the custom
 * domain (workers.dev is disabled), so requests cannot bypass that gateway.
 */

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();
  const host = requestHeaders.get('host') ?? '';

  // Local development remains usable without having to emulate Cloudflare
  // Access. This branch is never available on the public hostname.
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
    return {
      userId: 'local-developer',
      displayName: 'Edward Nnadi',
      email: 'edward.nnadi@jeanedwards.com',
      fullName: 'Edward Nnadi',
    };
  }

  const claims = decodeJwtPayload(requestHeaders.get(ACCESS_JWT_HEADER));
  const email = typeof claims?.email === 'string' ? claims.email : null;
  if (!email) return null;
  const fullName = typeof claims?.name === 'string' ? claims.name : null;

  return {
    userId: typeof claims?.sub === 'string' ? claims.sub : email,
    displayName: fullName ?? email,
    email,
    fullName,
  };
}

export async function requireChatGPTUser(
  _returnTo: string,
): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;
  throw new Error('Sign in through Cloudflare Access is required.');
}

export function chatGPTSignInPath(_returnTo: string): string {
  return '/';
}

export function chatGPTSignOutPath(_returnTo = '/'): string {
  return '/';
}

function decodeJwtPayload(token: string | null): Record<string, unknown> | null {
  if (!token) return null;
  const encodedPayload = token.split('.')[1];
  if (!encodedPayload) return null;
  try {
    const base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  } catch {
    return null;
  }
}
