import { getChatGPTUser, type ChatGPTUser } from '../app/chatgpt-auth';

const OWNERS = new Set([
  'edward@nnadi.com',
  'edward.nnadi@jeanedwards.com',
  'nnaemeka.ugwokegbe@jeanedwards.com',
]);

/**
 * Every operations endpoint authorises the same way. Keeping the owner list in
 * one module means adding a QC officer or storekeeper is a single edit rather
 * than a search for copies of the set.
 */
export async function authorize(): Promise<ChatGPTUser | null> {
  const user = await getChatGPTUser();
  return user && OWNERS.has(user.email.toLowerCase()) ? user : null;
}
