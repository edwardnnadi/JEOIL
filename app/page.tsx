import { requireChatGPTUser } from './chatgpt-auth';

export const dynamic = 'force-dynamic';

export default async function Home() {
  await requireChatGPTUser('/');
  return <iframe title="JE Oils Operations" src="/legacy.html" className="h-screen w-screen border-0" />;
}
