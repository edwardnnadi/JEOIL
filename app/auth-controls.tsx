'use client';

import { Show, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { Brand } from './brand';

export function AuthControls() {
  return (
    <header className="je-header">
      <Brand />
      <nav aria-label="Main navigation">
        <a
          className="je-company-link"
          href="https://jeoils.com"
          target="_blank"
          rel="noreferrer"
        >
          Company website ↗
        </a>
        <Show when="signed-out">
          <Link className="je-button je-button-small" href="/sign-in">
            Sign in <span aria-hidden="true">↗</span>
          </Link>
        </Show>
        <Show when="signed-in">
          <UserButton />
        </Show>
      </nav>
    </header>
  );
}
