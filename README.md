# AgentFactory OS

Production-oriented foundation for AgentFactory OS with frontend and backend kept as separate, independently installable codebases.

## Repository layout

```text
AgentFactory OS/
├── frontend/   # One Next.js application for marketing and workspace routes
└── backend/    # Express microservices, API contracts, Prisma, and PostgreSQL
```

Frontend and backend have separate manifests, lockfiles, dependencies, scripts, and environment files. They can be developed, tested, built, and deployed independently.

## Prerequisites

- Node.js 24.19.x
- pnpm 11.25.0
- Docker Desktop with Docker Compose

This repository uses pnpm. Do not run `npm install` or `npm update`; npm does not understand the repository's pnpm-specific configuration and lockfiles. The checked-in `.nvmrc` and `.node-version` pin Node.js 24.19.0.

On macOS with Homebrew, Node 24 can be selected for the current terminal with:

```bash
brew install node@24
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
pnpm self-update 11.25.0
node --version
pnpm --version
```

If `corepack` resolves to `/usr/local/bin/corepack`, do not use it for this setup. Older system-wide Corepack installations can fail on pnpm signing-key rotation or require permission to write into `/usr/local/bin`; the user-owned pnpm self-updater avoids both problems.

## Run the backend

```bash
cd backend
cp .env.example .env
pnpm install --frozen-lockfile
pnpm db:up
pnpm db:generate
pnpm db:migrate
pnpm dev
```

The REST and GraphQL gateway is available at `http://localhost:4000`. Domain services use ports 4001–4003. PostgreSQL is exposed locally on port 55432.

## Run the frontend

In another terminal:

```bash
cd frontend
cp .env.example .env.local
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000` for marketing and `http://localhost:3000/workspace` for the product workspace.

See `frontend/README.md` and `backend/README.md` for workspace-specific commands and boundaries.

## Current limits

- Authentication provider integration is deferred; the session endpoint reports an anonymous user.
- Test checkout cannot activate in production and is not a payment integration.
- PostgreSQL schemas and ownership are established; feature-level repositories are the next milestone.
- LLM runtime, integrations, queues, and background execution are not included yet.
