# MoveMate Abu Dhabi

MoveMate helps people arriving in Abu Dhabi prepare before they land and work through practical setup tasks with a conversational guide.

## Run and operate

- `pnpm --filter @workspace/api-server run dev` — run the GPT-enabled API server on port 5000.
- `pnpm --filter @workspace/movemate-abu-dhabi dev` — run the frontend on port 4173.
- `pnpm run typecheck` — typecheck the workspace.
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and schemas from the OpenAPI spec.
- Required for database commands: `DATABASE_URL` for a disposable development PostgreSQL database.

## AI secret

Use the same environment variable name on every host: `OPENAI_API_KEY`.

- In Replit, store it in the server's Secrets tool. For a published Replit app, add it to the deployment secrets too.
- On the hosted ChatGPT Site, store it as a private Site server secret with this name. The Site Worker reads it from its runtime environment; it is never sent to the browser.
- Never commit the key, add it to client code, or paste it into MoveMate chat. OpenAI API usage is billed separately from a ChatGPT subscription.

If the secret is absent, the app keeps its rule-based demo guide. The dashboard, onboarding, and browser voice still work without the secret.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Replit API: Express 5
- ChatGPT Site API: Cloudflare Worker-compatible ESM entrypoint
- Database: PostgreSQL + Drizzle ORM
- Validation and API codegen: Zod and Orval

## Product decisions

- Keep relocation task points as whole-number increments of 5.
- Use GPT-6 Luna for MoveMate replies when `OPENAI_API_KEY` is configured server-side; keep the free demo guide when it is not.
- Do not scrape job listings or pass passport, account, or payment details to the assistant.
- Use browser speech for spoken replies so audio generation does not add API calls. The chosen English voice depends on voices available on the user's device.
