import { BrandMark } from '@/components/ui';

const gatewayUrl = process.env.API_GATEWAY_URL ?? 'http://localhost:4000';

async function getFoundationStatus() {
  try {
    const sessionResponse = await fetch(`${gatewayUrl}/api/v1/session/status`, {
      cache: 'no-store',
    });
    const graphqlResponse = await fetch(`${gatewayUrl}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: '{ systemStatus { gateway { status } projectService { status } } }',
      }),
      cache: 'no-store',
    });

    if (!sessionResponse.ok || !graphqlResponse.ok) {
      return null;
    }

    return { session: await sessionResponse.json(), graph: await graphqlResponse.json() };
  } catch {
    return null;
  }
}

export default async function WorkspaceHome() {
  const status = await getFoundationStatus();

  return (
    <div className="af-app">
      <header className="af-topbar">
        <BrandMark />
        <span className="af-status">Foundation preview</span>
      </header>
      <main className="af-main">
        <aside className="af-panel">
          <strong>Explorer</strong>
          <p className="af-muted">
            Roles
            <br />
            Departments
            <br />
            Decisions
            <br />
            Work
          </p>
        </aside>
        <section className="af-canvas">
          <h1>Visual workspace foundation</h1>
          <p className="af-muted">No real agent execution is connected.</p>
          <p>Gateway: {status ? 'reachable' : 'offline'}</p>
        </section>
        <aside className="af-panel">
          <strong>Inspector</strong>
          <p className="af-muted">Select a future component to configure it.</p>
        </aside>
      </main>
    </div>
  );
}
