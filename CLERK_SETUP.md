# Clerk authentication

Linked application: JE Oils (`app_3ItpYf1cg7BRLSfFU9drwU5JGDp`).

The CLI stores development keys in ignored `.env.local`. Its vinext detection
uses `VITE_CLERK_PUBLISHABLE_KEY`; the provider and middleware accept that name
or `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. The secret key remains server-only.

The navigation offers Clerk sign-in/sign-up modals and a signed-in profile menu.
The existing API identity helper now uses Clerk authentication and a verified
primary email address. Existing owner allowlists are unchanged; creating an
account does not grant operations access.

## Local verification

- `clerk doctor` checks the CLI session, linked application, and configuration.
- `pnpm exec vinext dev --port 3100` runs against the current local database.
- Sign up in the navigation, verify the email, and confirm the profile menu
  appears. Check sign-out and subsequent sign-in as well.
- Anonymous requests to `/api/state` return 403.

The standard `pnpm dev` command currently encounters an existing local migration
error (`customers` already exists). Do not delete the database to work around it.
The full TypeScript check also reports existing errors in the QC and state APIs.
The production build encountered a locked `dist` directory while another
Wrangler preview was running. Production build and deployment remain unverified.
Clerk's production instance is not configured.

## Vinext compatibility

`proxy.ts` matches the homepage, all API/TRPC routes, and `/__clerk/:path*`.
Add future server-rendered pages to the matcher when they use Clerk.

For Clerk Next.js 7.9.1 on vinext 1.0.0-beta.5, `vite.config.ts` selects Clerk's
edge-safe filesystem helper, converts retained CommonJS imports in its ESM auth
helpers to ESM, and resolves the compatibility router to vinext. The server-only
guard remains present. Recheck these adapters when upgrading either package.

Setup reference: https://clerk.com/docs/nextjs/getting-started/quickstart

## Branded public pages

The signed-out homepage uses the supplied JE Oils logo and a team photograph
from the company website. Dedicated `/sign-in` and `/sign-up` catch-all routes
host Clerk components inside the JE Oils layout. The provider applies gold
and charcoal styling and routes successful authentication back to `/`.
The proxy matcher includes both authentication routes. Existing verified-user
and operations authorization checks remain in place.

Image source: https://jeoils.com/wp-content/uploads/2024/01/DJI_1281-resized.jpg
