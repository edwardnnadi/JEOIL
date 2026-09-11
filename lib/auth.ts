export type OperationsUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string;
};

const LOCAL_OPERATIONS_USER: OperationsUser = {
  userId: 'local-operations-user',
  displayName: 'JE Oils Operations',
  email: 'operations@jeoils.test',
  fullName: 'JE Oils Operations',
};

export async function authorize(): Promise<OperationsUser | null> {
  const requestHeaders = await headers();
  const email = requestHeaders.get('cf-access-authenticated-user-email')?.trim().toLowerCase();
  if (email) {
    return {
      userId: email,
      displayName: email,
      email,
      fullName: requestHeaders.get('cf-access-authenticated-user-name')?.trim() || email,
    };
  }

  // Cloudflare Access supplies the identity header in production. Retain the
  // local identity only for development, so protected operations cannot be
  // performed anonymously on the live application.
  return process.env.NODE_ENV === 'production' ? null : LOCAL_OPERATIONS_USER;
}
import { headers } from 'next/headers';
