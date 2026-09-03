import { requireChatGPTUser } from './chatgpt-auth';

export const dynamic = 'force-dynamic';

export default async function Home() {
  await requireChatGPTUser('/');
  return <iframe title="JE Oils Operations" src="/legacy.html?v=warehouse-goods-inwards-20260903" className="h-screen w-screen border-0" />;
}
