# AgentFactory OS backend

Independent backend workspace for AgentFactory OS.

## Contents

- `services/api-gateway` — browser-facing REST and GraphQL BFF on port 4000.
- `services/identity-service` — identity boundary on port 4001.
- `services/entitlement-service` — plan and entitlement boundary on port 4002.
- `services/project-service` — project boundary on port 4003.
- `packages/api-contracts-rest` — OpenAPI contract.
- `packages/api-contracts-graphql` — GraphQL schema.
- `infrastructure/docker` — local PostgreSQL 17 environment.

Each domain service owns its database and never reads another service's tables.

## Local development

Use Node.js 24.19.x and pnpm 11.25.0. This is a pnpm workspace, so do not use `npm install` or `npm update`.

```bash
cp .env.example .env
pnpm install --frozen-lockfile
pnpm db:up
pnpm db:generate
pnpm db:migrate
pnpm dev
```

## Quality checks

```bash
pnpm check
```
