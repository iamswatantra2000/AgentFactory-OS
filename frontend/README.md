# AgentFactory OS frontend

Independent Next.js frontend for AgentFactory OS. Marketing, authentication, and product workspace routes share one application and deployment.

## Contents

- `app/(marketing)` — public and SEO-friendly routes, including `/`.
- `app/(workspace)` — product routes, including `/workspace`.
- `components` — shared React components.
- `app/tokens.css` — shared design tokens.

## Local development

Use Node.js 24.x and pnpm 11.25.0. Do not use `npm install` or `npm update`.

```bash
cp .env.example .env.local
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000` for marketing and `http://localhost:3000/workspace` for the workspace. The server communicates with the backend through `API_GATEWAY_URL`, which defaults to `http://localhost:4000`.

## Quality checks

```bash
pnpm check
```
