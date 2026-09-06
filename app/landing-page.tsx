/* oxlint-disable next/no-img-element -- Native images avoid next/image React runtime conflicts in vinext. */
import Link from 'next/link';
import {
  ArrowDown,
  ArrowUpRight,
  ShieldCheck,
  MoveUpRight,
} from 'lucide-react';
import { BrandMotion } from './brand-motion';
import { WorkspaceExplorer } from './workspace-explorer';

export function LandingPage() {
  return (
    <BrandMotion smooth>
      <main className="je-landing" id="main-content">
        <section className="je-hero" aria-labelledby="hero-title">
          <div className="je-hero-copy">
            <p className="je-eyebrow" data-enter>
              <span className="je-status-dot" /> PEOPLE. PROCESS. PURPOSE.
            </p>
            <h1 id="hero-title" data-enter>
              A better way
              <br />
              to move
              <br />
              <em>forward.</em>
            </h1>
            <p className="je-intro" data-enter>
              Great things happen when we work as one.
              <br />
              Your people, your processes, and every part of
              <br className="je-desktop-break" /> JE Oils — connected in one
              workspace.
            </p>
            <div className="je-hero-actions" data-enter>
              <Link href="/sign-in" className="je-button">
                Enter workspace <ArrowUpRight size={19} />
              </Link>
              <a
                className="je-round-link"
                href="#workspace"
                aria-label="Explore the workspace"
              >
                <ArrowDown size={19} />
              </a>
              <span className="je-explore-label">
                Discover
                <br />
                your workspace
              </span>
            </div>
            <p className="je-access-note" data-enter>
              <ShieldCheck size={14} /> For the people behind JE Oils
            </p>
          </div>
          <div className="je-hero-visual" data-enter>
            <div className="je-photo-index">
              <span>JE OILS / OUR PEOPLE</span>
              <span>ABUJA, NIGERIA ↗</span>
            </div>
            <div className="je-hero-photo">
              <img
                src="/brand/facility.jpg"
                alt="JE Oils team members together on the production floor"
                fetchPriority="high"
              />
              <div className="je-photo-caption">
                <span>REAL PEOPLE. SHARED PURPOSE.</span>
                <p>
                  The energy
                  <br />
                  behind <em>every day.</em>
                </p>
              </div>
            </div>
            <div className="je-photo-bottom">
              <span>JEAN EDWARDS OILS LTD.</span>
              <span>Inspired by change.</span>
            </div>
            <div className="je-seal" aria-hidden="true">
              <MoveUpRight size={32} strokeWidth={1} />
              <span>
                FORWARD
                <br />
                TOGETHER
              </span>
            </div>
          </div>
        </section>
        <div className="je-principles">
          <span>BUILT AROUND THE WAY WE WORK</span>
          <p>
            Source <span>↗</span> Produce <span>↗</span> Assure <span>↗</span>{' '}
            Deliver
          </p>
          <span>ONE CONNECTED OPERATION</span>
        </div>
        <WorkspaceExplorer />
        <section className="je-purpose" data-reveal>
          <div>
            <p className="je-eyebrow">02 / OUR SHARED PURPOSE</p>
            <h2>
              Behind every process,
              <br />
              <em>there’s a person.</em>
            </h2>
          </div>
          <div>
            <p>
              This is where our work comes together. A space for clear
              handovers, shared understanding, and the small decisions that make
              a big difference.
            </p>
            <a
              href="https://jeoils.com"
              target="_blank"
              rel="noreferrer"
              className="je-text-link"
            >
              Meet Jean Edwards Oils <ArrowUpRight size={17} />
            </a>
          </div>
        </section>
        <section className="je-bottom-cta" data-reveal>
          <div className="je-cta-orbits" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className="je-eyebrow">YOUR NEXT CHAPTER STARTS HERE</p>
          <h2>
            Let’s get
            <br />
            <em>to work.</em>
            <ArrowUpRight aria-hidden="true" />
          </h2>
          <div className="je-cta-bottom">
            <p>
              Your team is moving forward.
              <br />
              Step into your workspace.
            </p>
            <Link className="je-button" href="/sign-in">
              Sign in to JE Oils <ArrowUpRight size={19} />
            </Link>
          </div>
        </section>
        <footer className="je-footer">
          <span>
            JE OILS<span className="je-footer-motto">INSPIRED BY CHANGE</span>
          </span>
          <p>© {new Date().getFullYear()} Jean Edwards Oils Ltd.</p>
          <a href="https://jeoils.com" target="_blank" rel="noreferrer">
            Company website <ArrowUpRight size={14} />
          </a>
        </footer>
      </main>
    </BrandMotion>
  );
}
