# AgentFactory OS backend

Independent backend workspace for AgentFactory OS.

## Contents

- `services/api-gateway` — browser-facing REST and GraphQL BFF on port 4000.
- `services/identity-service` — identity boundary on port 4001.
- `services/entitlement-service` — plan and entitlement boundary on port 4002.
- `services/project-service` — project boundary on port 4003.
- `packages/api-contracts-rest` — OpenAPI contract.
- `packages/api-contracts-graphql` — GraphQL schema.
- `infrastructure/docker` — local PostgreSQL 17 and Mailpit development email inbox.

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

Open Mailpit at `http://localhost:8025` to inspect verification and password-reset messages. It captures mail locally; no paid email account is needed during development. Email links use URL fragments so one-time tokens are not sent in ordinary page requests. Tokens are hashed in PostgreSQL, expire, and are consumed once. Password reset revokes existing sessions.

For Google and Microsoft, register OAuth web applications and set the corresponding `*_CLIENT_ID` and `*_CLIENT_SECRET` values in `backend/.env`. Add these exact callback URLs to the provider registrations: `http://localhost:3000/api/auth/oauth/google/callback` and `http://localhost:3000/api/auth/oauth/microsoft/callback`. Set `APP_BASE_URL` to the deployed frontend origin for production. Microsoft tenant can be configured with `MICROSOFT_TENANT_ID` (`common` by default). Apple requires an Apple Developer account, a Services ID, key, and an HTTPS callback; configure `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, and `APPLE_PRIVATE_KEY` when available. Unconfigured providers stay visibly unavailable in the UI.

Before public launch, add a shared-store rate limiter for authentication endpoints, verified production SMTP, secret rotation, account-recovery monitoring, and tests with real OAuth provider registrations. The local Mailpit service is not a production email delivery service.

## Quality checks

```bash
pnpm check
```

## Account and landing-page flow

The frontend remains a separate Next.js application. Its browser-facing route handler forwards account actions to the gateway, while the gateway owns the `af_session` cookie and the identity service owns password verification and session records.

| Page or endpoint                       | Purpose                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------- |
| `/`                                    | Public landing page; authenticated visitors are redirected to `/welcome`.  |
| `/login`                               | Existing-account sign-in.                                                  |
| `/signup` (`/register` redirects here) | Creates an account and owner workspace; sends verification email.          |
| `/verify-email`                        | Consumes the verification link and creates a session.                      |
| `/forgot-password`, `/reset-password`  | Requests and completes password recovery.                                  |
| `/welcome`                             | Authenticated landing page with Projects CTAs.                             |
| `/projects`                            | Account-level project selection and plan usage; default login destination. |
| `/projects/:id/setup`                  | Completes a preparing project shell.                                       |
| `/projects/:id/overview`               | Project-scoped operational overview.                                       |
| `/projects/:id/playground`             | Visual Factory draft editor for project workflows.                         |
| `/dashboard`                           | Redirects to `/projects`.                                                  |
| `POST /api/v1/auth/signup`             | Create account and request verification.                                   |
| `POST /api/v1/auth/login`              | Verify credentials and create session.                                     |
| `GET /api/v1/session/status`           | Validate the browser session.                                              |
| `POST /api/v1/auth/logout`             | Revoke session and clear cookie.                                           |

The frontend calls these endpoints through same-origin `/api/auth` route handlers. Set `API_GATEWAY_URL` for the frontend and `IDENTITY_SERVICE_URL` for the gateway when the services are not running on their local defaults. Sessions are stored server-side and expire after seven days. The cookie is HttpOnly and SameSite=Lax; it is marked Secure in production.

## Projects

Project records and membership live in the project service database. Apply its migrations with `pnpm db:migrate` after pulling schema changes. Set `PROJECT_SERVICE_INTERNAL_TOKEN` to the same secret for gateway and project service, and set `PROJECT_LIMIT` for development capacity. The gateway validates the browser session with identity and checks selected members against the workspace roster before forwarding a project request. The project service does not accept browser cookies directly.

Creating a project reserves a slot in `preparing` state. Finishing setup creates its document shell and marks it active. Login, email verification, and payment success land on `/projects`; a returning user chooses a project explicitly. Archived projects are excluded from standard results, and restoring one re-checks plan capacity. The current plan is a local development limit, not a live paid subscription. Agent execution, reviews, ledger records, and outcomes are not yet persisted services; the overview presents empty states rather than sample metrics.

The playground draft is exposed through `GET` and `POST /api/v1/projects/:projectId/graph`. The gateway uses the current session and project membership; the project service allows active-project Owners and Admins to save. Writes validate graph size, node types, connections, and acyclicity, then compare `expectedUpdatedAt` to prevent overwriting a newer draft (HTTP 409). A saved graph is design data only; it does not invoke agents or publish work.

Graphs may contain repeatable `handoff` nodes with `recipientType` (`person` or `agent`) and `recipientName`. This supports multi-stage chains such as manager → CEO or agent → agent before output. Recipient details are stored in the project draft only; the execution and notification services must enforce actual recipient resolution and delivery when those services are implemented.
