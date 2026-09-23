# AI Insights setup

AI Insights sends a reduced operational snapshot to the OpenAI Responses API from the server. It does not send people contact details, attachments, or credentials.

## Important account distinction

Users cannot sign in with a ChatGPT account to authorize this application to call the API. ChatGPT subscriptions and OpenAI API projects are separate products with separate billing. Do not ask users for their ChatGPT password or paste an API key into the browser.

## Configure the server

1. Create an API key in the OpenAI API project that will pay for the application's usage.
2. Add that key as the server-side `OPENAI_API_KEY` secret in the deployment environment. For a local Cloudflare/Wrangler run, use a non-committed `.dev.vars` file containing `OPENAI_API_KEY=...`.
3. Redeploy or restart the application.

The endpoint uses `gpt-5.6-luna` with `store: false`. Users continue to authenticate to the JE Oils application through Cloudflare Access; no separate OpenAI login is shown.

## Troubleshooting

The UI now identifies common safe-to-display causes: missing or invalid key, API billing/rate limits, unavailable model, provider outage, and timeout. Administrators should inspect their API project’s billing, usage limits, model access, and server secret when one of these appears.
