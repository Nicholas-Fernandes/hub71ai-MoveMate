# MoveMate Abu Dhabi — Server Test Setup

This archive contains the full pnpm workspace source, including the app, API, shared libraries, mockup sandbox, and the separate design-system artifact. The design-system artifact is still a starter/in-progress artifact and has not been applied to the app. It is not required to run MoveMate.

## Requirements

- Node.js 24
- pnpm 10.26.1 (lockfile v9)
- A PostgreSQL database for the API

## Install

From the extracted project root:

```sh
pnpm install --frozen-lockfile
```

Set `DATABASE_URL` in the server environment to a connection string for a test PostgreSQL database. No secrets or `.env` files are included in this archive. To initialize or update the schema on a disposable development database:

```sh
pnpm --filter @workspace/db run push
```

This schema-push command is for development/testing databases, not production migration management.

## Start MoveMate for testing

Run the API and web app in separate terminals from the project root:

```sh
PORT=5000 pnpm --filter @workspace/api-server run dev
```

```sh
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/movemate-abu-dhabi run dev
```

The Vite config requires both `PORT` and `BASE_PATH`; `/` is the root-path setting. The API client makes same-origin requests to `/api/*`, so place both services behind one host: proxy `/api/` to `127.0.0.1:5000` and other paths to `127.0.0.1:5173`. Keep the API port private and expose the reverse proxy instead. If you serve the web app under a subpath, set `BASE_PATH` to that path with leading and trailing slashes and configure the proxy accordingly.

For example, a reverse proxy can route `/api/` to `http://127.0.0.1:5000` and `/` to `http://127.0.0.1:5173`. Use TLS and production build/static serving before exposing the app publicly; the dev servers are intended for testing.

## Build check

```sh
pnpm run typecheck
pnpm run build
```

The API development script builds the API before starting it. For a production API process, build it first and then run `PORT=5000 pnpm --filter @workspace/api-server run start`.

## Not included

Installed `node_modules`, generated `dist` output, Git history, Replit Agent skill/memory folders, local caches, database files, private keys, and environment/secret files are excluded. Replit-managed secrets must be configured separately on your server; never copy secret values into source control.
