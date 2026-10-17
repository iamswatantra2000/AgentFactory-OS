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

## Account and landing-page flow

The frontend remains a separate Next.js application. Its browser-facing route handler forwards account actions to the gateway, while the gateway owns the `af_session` cookie and the identity service owns password verification and session records.

| Page or endpoint                       | Purpose                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------- |
| `/`                                    | Public landing page; authenticated visitors are redirected to `/welcome`. |
| `/login`                               | Existing-account sign-in.                                                 |
| `/signup` (`/register` redirects here) | Creates an account and owner workspace.                                   |
| `/welcome`                             | Authenticated landing page with dashboard CTAs.                           |
| `/dashboard`                           | Authenticated workspace preview.                                          |
| `POST /api/v1/auth/signup`             | Create account and session.                                               |
| `POST /api/v1/auth/login`              | Verify credentials and create session.                                    |
| `GET /api/v1/session/status`           | Validate the browser session.                                             |
| `POST /api/v1/auth/logout`             | Revoke session and clear cookie.                                          |

The frontend calls these endpoints through its same-origin `/api/auth/{signup,login,logout}` route handler. Set `API_GATEWAY_URL` for the frontend and `IDENTITY_SERVICE_URL` for the gateway when the services are not running on their local defaults. Sessions are stored server-side and expire after seven days. The cookie is HttpOnly and SameSite=Lax; it is marked Secure in production.

This is the first account-flow slice, not a complete public-launch identity system. Before exposing signup broadly, add email verification, password recovery, request throttling/abuse controls, and an operational session-management policy.
