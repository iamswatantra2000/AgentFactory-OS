# ADR 0001 Platform foundation

## Status

Accepted for the initial foundation.

## Decision

Use one repository with autonomous `frontend` and `backend` TypeScript codebases. The frontend is one Next.js application with route groups for marketing, authentication, and the product workspace. The backend is a pnpm/Turborepo workspace containing Express services, API contracts, PostgreSQL with database-per-service ownership, and Prisma migrations. Use REST for session and command-oriented boundaries, GraphQL for frontend aggregation, and synchronous HTTP before introducing messaging.

## Consequences

Frontend and backend dependencies cannot leak across their boundary, and each side can evolve and deploy independently. Marketing and workspace features share one build and deployment, reducing configuration, routing, authentication, and design-system duplication. A microfrontend should be extracted only when team ownership or independent deployment requirements justify it. No new backend service should be added without a bounded context and deployment need. Runtime module federation and message brokers remain deferred until evidence justifies them.
