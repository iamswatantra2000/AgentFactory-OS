# AgentFactory OS frontend

Independent Next.js frontend for AgentFactory OS. Marketing, authentication, and product workspace routes share one application and deployment.

## Contents

- `app/(marketing)` — public and SEO-friendly routes, including `/`.
- `app/(workspace)` — account and project routes, including `/projects`.
- `components` — shared React components.
- `app/tokens.css` — shared design tokens.

## Local development

Use Node.js 24.x and pnpm 11.25.0. Do not use `npm install` or `npm update`.

```bash
cp .env.example .env.local
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000` for marketing and `http://localhost:3000/dashboard` for the authenticated dashboard. The server communicates with the backend through `API_GATEWAY_URL`, which defaults to `http://localhost:4000`.

Authentication screens are `/signup`, `/login`, `/verify-email`, `/forgot-password`, and `/reset-password`, with separate success screens. Signup requires email verification before the first session. Social sign-in buttons reflect provider availability from the backend; see `backend/README.md` for local credentials and callback setup. The auth card fits normal desktop viewports without document scrolling and permits scrolling on compact devices so form controls remain accessible.

After authentication, members return to the landing page at `/welcome`, where the CTA changes to **Go to dashboard**. `/dashboard` shows the account-level Projects home (also available at `/projects`) and supports multiple active, paused, and archived projects. Create project is a four-step flow (details, starting point, members, review), followed by `/projects/:projectId/setup` before the project overview opens. Account navigation (`/templates`, `/members`, `/plan`, `/settings`) is separate from project navigation. Projects home supports search, list/grid display, sorting, archived filtering, role-aware status actions, and an exact development-plan project limit. Project-level operational sections currently show honest empty states until the corresponding agent/run/review services exist.

The project overview's **Open playground** action leads to `/projects/:projectId/playground`. Visual Factory has project navigation on the left, an editable workflow canvas in the middle, and a draggable agent/control library on the right. The add buttons also support keyboard and touch use. Owners and Admins of active projects can add, move, connect, describe, preview, and save draft steps; other members have read-only access. Saving persists the graph to the project document with revision conflict protection. Preview and save do not run agents or publish outputs; execution remains a separate future integration.

Agents support multiple incoming and outgoing connections. Drag an Out handle to another step's In handle to branch or merge work. Select a connection to change its source or destination, remove it, or **Insert handoff**. In Details, name each handoff recipient (person or agent) to build `Agent → Manager → CEO → Output`. **Add a handoff branch** creates an additional route without replacing existing connections. Trigger and Output are start/end controls; change a renamed role to **Agent** in Step type when it needs both incoming and outgoing connections. Cycles and duplicate connections are rejected; use a separate later handoff stage for reporting back.

The editor uses React Flow for pan, zoom, snapping, endpoint reconnection, and accessible node navigation. **Arrange** supports horizontal or top-down layouts; **Fit all** keeps large graphs in view. Library and Details have separate tabs. Undo/Redo covers graph edits; **Review flow** previews responsibilities and routes. These are draft instructions, not live notifications or agent execution.

## Quality checks

```bash
pnpm check
```
