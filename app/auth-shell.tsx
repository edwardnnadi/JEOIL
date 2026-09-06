/* oxlint-disable next/no-img-element -- Native images avoid next/image React runtime conflicts in this vinext app. */
import Link from 'next/link';
import { BrandMotion } from './brand-motion';
import { ShieldCheck, ArrowLeft } from 'lucide-react';

export function AuthShell({
  children,
  registering = false,
}: {
  children: React.ReactNode;
  registering?: boolean;
}) {
  return (
    <BrandMotion>
      <main className="je-auth" id="main-content">
        <aside className="je-auth-story">
          <img
            className="je-auth-photo"
            src="/brand/facility.jpg"
            alt="JE Oils facility"
          />
          <div className="je-auth-story-content">
            <p className="je-eyebrow">JEAN EDWARDS OILS LTD.</p>
            <p className="je-story-title">
              Good work starts
              <br />
              with a connected
              <br />
              <em>team.</em>
            </p>
            <p>
              Your people. Your processes. Your purpose.
              <br />
              Together in one workspace.
            </p>
            <span className="je-auth-motto">INSPIRED BY CHANGE</span>
          </div>
        </aside>
        <section className="je-auth-form">
          <Link href="/" className="je-back">
            <ArrowLeft size={16} /> Back to home
          </Link>
          <div className="je-auth-form-inner">
            <p className="je-eyebrow">
              {registering
                ? 'JE OILS · JOIN THE TEAM'
                : 'JE OILS · WELCOME BACK'}
            </p>

            {children}
            <p className="je-auth-help">
              <ShieldCheck size={17} /> Workspace access is limited to approved
              team members. Contact your administrator if you need access.
            </p>
          </div>
          <p className="je-auth-copyright">
            © {new Date().getFullYear()} Jean Edwards Oils Ltd.
          </p>
        </section>
      </main>
    </BrandMotion>
  );
}
