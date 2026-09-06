import { getChatGPTUser } from './chatgpt-auth';
import { LandingPage } from './landing-page';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getChatGPTUser();
  if (!user) return <LandingPage />;
  return (
    <iframe
      title="JE Oils Operations"
      src="/legacy.html?v=operations-brand-20260905b"
      className="je-operations-frame"
    />
  );
}
