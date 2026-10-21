import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from './app.js';
import {
  ProjectForbiddenError,
  ProjectLimitError,
  ProjectNotFoundError,
  ProjectRevisionConflictError,
  type ProjectRepository,
  type WorkflowGraph,
} from './repository.js';

const token = 'test-internal-token-123456';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const projectId = '33333333-3333-4333-8333-333333333333';
const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

async function start(repository: Partial<ProjectRepository>) {
  const server = createApp({ projectLimit: 5, ...repository } as ProjectRepository, token).listen(
    0,
    '127.0.0.1',
  );
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  return `http://127.0.0.1:${address.port}`;
}

function headers() {
  return {
    'content-type': 'application/json',
    'x-af-internal-token': token,
    'x-af-workspace-id': workspaceId,
    'x-af-user-id': userId,
  };
}

describe('project HTTP boundary', () => {
  it('rejects public requests before reading project data', async () => {
    const list = vi.fn();
    const base = await start({ list });
    const response = await fetch(`${base}/v1/projects`);
    expect(response.status).toBe(403);
    expect(list).not.toHaveBeenCalled();
  });

  it('lists only in the authenticated workspace context', async () => {
    const list = vi.fn(async () => ({
      projects: [],
      plan: { name: 'Development plan', projectLimit: 5, projectCount: 0 },
    }));
    const base = await start({ list });
    const response = await fetch(`${base}/v1/projects`, { headers: headers() });
    expect(response.status).toBe(200);
    expect(list).toHaveBeenCalledWith(workspaceId, userId);
  });

  it('rejects invalid project creation before storage', async () => {
    const create = vi.fn();
    const base = await start({ create });
    const response = await fetch(`${base}/v1/projects`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ name: 'A', outcome: 'short', startingPoint: 'template' }),
    });
    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('returns an exact limit error for a full plan', async () => {
    const base = await start({
      create: vi.fn(async () => {
        throw new ProjectLimitError();
      }),
    });
    const response = await fetch(`${base}/v1/projects`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        name: 'Customer intelligence',
        outcome: 'Prepare weekly customer insights for leadership.',
        ownerId: userId,
        teamName: 'Growth',
        startingPoint: 'blank',
        members: [],
      }),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ title: 'Project limit reached: 5' });
  });

  it('does not reveal inaccessible projects', async () => {
    const base = await start({
      get: vi.fn(async () => {
        throw new ProjectNotFoundError();
      }),
    });
    const response = await fetch(`${base}/v1/projects/${projectId}`, { headers: headers() });
    expect(response.status).toBe(404);
  });

  it('enforces role checks on status changes', async () => {
    const base = await start({
      changeStatus: vi.fn(async () => {
        throw new ProjectForbiddenError();
      }),
    });
    const response = await fetch(`${base}/v1/projects/${projectId}/state`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ status: 'archived' }),
    });
    expect(response.status).toBe(403);
  });

  it('reads a project-scoped workflow graph', async () => {
    const graph = { nodes: [], edges: [] };
    const getGraph = vi.fn(async () => ({ graph, updatedAt: null }));
    const base = await start({ getGraph });
    const response = await fetch(`${base}/v1/projects/${projectId}/graph`, { headers: headers() });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ graph, updatedAt: null });
    expect(getGraph).toHaveBeenCalledWith(workspaceId, userId, projectId);
  });

  it('persists the dedicated business prompt and agent decision responsibilities', async () => {
    const agentId = '44444444-4444-4444-8444-444444444444';
    const graph: WorkflowGraph = {
      nodes: [
        {
          id: projectId,
          kind: 'trigger',
          label: 'Business brief',
          description: '',
          businessPrompt: 'We sell sustainable apparel.',
          x: 0,
          y: 0,
        },
        {
          id: agentId,
          kind: 'agent',
          label: 'CEO',
          description: 'Set direction',
          x: 300,
          y: 0,
          responsibility: {
            roleMeaning: 'Accountable for strategy',
            work: 'Review plans',
            decisionProcess: 'Compare options',
            decisionCriteria: 'Customer value and margin',
            handoff: 'Send decision and rationale',
          },
        },
      ],
      edges: [{ id: '55555555-5555-4555-8555-555555555555', source: projectId, target: agentId }],
    };
    const saveGraph = vi.fn(async () => ({ graph, updatedAt: '2026-10-21T00:00:00.000Z' }));
    const base = await start({ saveGraph });
    const response = await fetch(`${base}/v1/projects/${projectId}/graph`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ graph, expectedUpdatedAt: null }),
    });
    expect(response.status).toBe(200);
    expect(saveGraph).toHaveBeenCalledWith(workspaceId, userId, projectId, graph, null);
  });

  it('rejects an incoming route or model on a dedicated business start', async () => {
    const saveGraph = vi.fn();
    const base = await start({ saveGraph });
    const agentId = '44444444-4444-4444-8444-444444444444';
    const response = await fetch(`${base}/v1/projects/${projectId}/graph`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        graph: {
          nodes: [
            {
              id: projectId,
              kind: 'trigger',
              label: 'Business brief',
              description: '',
              businessPrompt: 'Context',
              modelConfig: { provider: 'openai', modelId: 'example', effort: 'low' },
              x: 0,
              y: 0,
            },
            { id: agentId, kind: 'agent', label: 'CEO', description: '', x: 300, y: 0 },
          ],
          edges: [
            { id: '55555555-5555-4555-8555-555555555555', source: agentId, target: projectId },
          ],
        },
        expectedUpdatedAt: null,
      }),
    });
    expect(response.status).toBe(400);
    expect(saveGraph).not.toHaveBeenCalled();
  });

  it('rejects disconnected references and loops before saving a graph', async () => {
    const saveGraph = vi.fn();
    const base = await start({ saveGraph });
    const response = await fetch(`${base}/v1/projects/${projectId}/graph`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        expectedUpdatedAt: null,
        graph: {
          nodes: [
            { id: projectId, kind: 'agent', label: 'Analyst', description: '', x: 100, y: 100 },
          ],
          edges: [
            { id: '44444444-4444-4444-8444-444444444444', source: projectId, target: projectId },
          ],
        },
      }),
    });
    expect(response.status).toBe(400);
    expect(saveGraph).not.toHaveBeenCalled();
  });

  it('saves a bounded feedback conversation to an upstream CEO', async () => {
    const ceo = projectId;
    const romy = '44444444-4444-4444-8444-444444444444';
    const graph: WorkflowGraph = {
      nodes: [
        { id: ceo, kind: 'trigger', label: 'CEO', description: '', x: 100, y: 100 },
        { id: romy, kind: 'agent', label: 'Romy', description: '', x: 400, y: 100 },
      ],
      edges: [
        { id: '55555555-5555-4555-8555-555555555555', source: ceo, target: romy },
        {
          id: '66666666-6666-4666-8666-666666666666',
          source: romy,
          target: ceo,
          kind: 'feedback',
          label: 'Recheck the proposed solution',
          maxRounds: 3,
        },
      ],
    };
    const saveGraph = vi.fn(async () => ({ graph, updatedAt: '2026-10-19T00:00:00.000Z' }));
    const base = await start({ saveGraph });
    const response = await fetch(`${base}/v1/projects/${projectId}/graph`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ graph, expectedUpdatedAt: null }),
    });
    expect(response.status).toBe(200);
    expect(saveGraph).toHaveBeenCalledWith(workspaceId, userId, projectId, graph, null);
  });

  it('accepts multiple inputs and outputs for every node type', async () => {
    const ids = Array.from(
      { length: 9 },
      (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    );
    const kinds = [
      'agent',
      'agent',
      'trigger',
      'agent',
      'handoff',
      'review',
      'output',
      'agent',
      'agent',
    ] as const;
    const nodes: WorkflowGraph['nodes'] = ids.map((nodeId, index) => ({
      id: nodeId,
      kind: kinds[index]!,
      label: `Step ${index + 1}`,
      description: '',
      x: index * 100,
      y: 100,
    }));
    const edges: WorkflowGraph['edges'] = [];
    for (const center of ids.slice(2, 7)) {
      for (const source of ids.slice(0, 2)) {
        edges.push({
          id: `10000000-0000-4000-8000-${String(edges.length + 1).padStart(12, '0')}`,
          source,
          target: center,
        });
      }
      for (const target of ids.slice(7)) {
        edges.push({
          id: `10000000-0000-4000-8000-${String(edges.length + 1).padStart(12, '0')}`,
          source: center,
          target,
        });
      }
    }
    const graph: WorkflowGraph = { nodes, edges };
    const saveGraph = vi.fn(async () => ({ graph, updatedAt: '2026-10-19T00:00:00.000Z' }));
    const base = await start({ saveGraph });
    const response = await fetch(`${base}/v1/projects/${projectId}/graph`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ graph, expectedUpdatedAt: null }),
    });
    expect(response.status).toBe(200);
    expect(saveGraph).toHaveBeenCalledWith(workspaceId, userId, projectId, graph, null);
  });

  it('rejects a feedback edge without an upstream production path', async () => {
    const saveGraph = vi.fn();
    const base = await start({ saveGraph });
    const response = await fetch(`${base}/v1/projects/${projectId}/graph`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        expectedUpdatedAt: null,
        graph: {
          nodes: [
            { id: projectId, kind: 'agent', label: 'CEO', description: '', x: 100, y: 100 },
            {
              id: '44444444-4444-4444-8444-444444444444',
              kind: 'agent',
              label: 'Romy',
              description: '',
              x: 400,
              y: 100,
            },
          ],
          edges: [
            {
              id: '55555555-5555-4555-8555-555555555555',
              source: '44444444-4444-4444-8444-444444444444',
              target: projectId,
              kind: 'feedback',
              maxRounds: 2,
            },
          ],
        },
      }),
    });
    expect(response.status).toBe(400);
    expect(saveGraph).not.toHaveBeenCalled();
  });

  it('saves a valid draft with the caller and expected revision', async () => {
    const graph = {
      nodes: [
        {
          id: projectId,
          kind: 'trigger' as const,
          label: 'New request',
          description: '',
          modelConfig: {
            provider: 'anthropic' as const,
            modelId: 'claude-sonnet-4-5-20250929',
            effort: 'high' as const,
          },
          x: 100,
          y: 100,
        },
      ],
      edges: [],
    } satisfies WorkflowGraph;
    const saveGraph = vi.fn(async () => ({ graph, updatedAt: '2026-10-19T00:00:00.000Z' }));
    const base = await start({ saveGraph });
    const response = await fetch(`${base}/v1/projects/${projectId}/graph`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ graph, expectedUpdatedAt: null }),
    });
    expect(response.status).toBe(200);
    expect(saveGraph).toHaveBeenCalledWith(workspaceId, userId, projectId, graph, null);
  });

  it('rejects an unsupported agent effort level', async () => {
    const saveGraph = vi.fn();
    const base = await start({ saveGraph });
    const response = await fetch(`${base}/v1/projects/${projectId}/graph`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        expectedUpdatedAt: null,
        graph: {
          nodes: [
            {
              id: projectId,
              kind: 'agent',
              label: 'CEO',
              description: 'Review final decisions.',
              modelConfig: {
                provider: 'anthropic',
                modelId: 'claude-sonnet-4-5-20250929',
                effort: 'maximum',
              },
              x: 100,
              y: 100,
            },
          ],
          edges: [],
        },
      }),
    });
    expect(response.status).toBe(400);
    expect(saveGraph).not.toHaveBeenCalled();
  });

  it('saves consecutive manager and CEO handoffs before output', async () => {
    const managerId = '55555555-5555-4555-8555-555555555555';
    const ceoId = '66666666-6666-4666-8666-666666666666';
    const outputId = '77777777-7777-4777-8777-777777777777';
    const graph: WorkflowGraph = {
      nodes: [
        { id: projectId, kind: 'agent', label: 'Research Writer', description: '', x: 100, y: 100 },
        {
          id: managerId,
          kind: 'handoff',
          label: 'Manager update',
          description: 'Send findings and risks.',
          recipientType: 'person',
          recipientName: 'Manager',
          x: 350,
          y: 100,
        },
        {
          id: ceoId,
          kind: 'handoff',
          label: 'Executive brief',
          description: 'Forward the approved summary.',
          recipientType: 'person',
          recipientName: 'CEO',
          x: 600,
          y: 100,
        },
        { id: outputId, kind: 'output', label: 'Final report', description: '', x: 850, y: 100 },
      ],
      edges: [
        { id: '11111111-1111-4111-8111-111111111111', source: projectId, target: managerId },
        { id: '22222222-2222-4222-8222-222222222222', source: managerId, target: ceoId },
        { id: '33333333-3333-4333-8333-333333333333', source: ceoId, target: outputId },
      ],
    };
    const saveGraph = vi.fn(async () => ({ graph, updatedAt: '2026-10-19T00:00:00.000Z' }));
    const base = await start({ saveGraph });
    const response = await fetch(`${base}/v1/projects/${projectId}/graph`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ graph, expectedUpdatedAt: null }),
    });
    expect(response.status).toBe(200);
    expect(saveGraph).toHaveBeenCalledWith(workspaceId, userId, projectId, graph, null);
  });

  it('accepts a handoff addressed to another agent', async () => {
    const handoffId = '55555555-5555-4555-8555-555555555555';
    const graph: WorkflowGraph = {
      nodes: [
        { id: projectId, kind: 'agent', label: 'Data Analyst', description: '', x: 100, y: 100 },
        {
          id: handoffId,
          kind: 'handoff',
          label: 'Send findings',
          description: 'Share the cleaned data.',
          recipientType: 'agent',
          recipientName: 'Research Writer',
          x: 350,
          y: 100,
        },
      ],
      edges: [{ id: '11111111-1111-4111-8111-111111111111', source: projectId, target: handoffId }],
    };
    const saveGraph = vi.fn(async () => ({ graph, updatedAt: '2026-10-19T00:00:00.000Z' }));
    const base = await start({ saveGraph });
    const response = await fetch(`${base}/v1/projects/${projectId}/graph`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ graph, expectedUpdatedAt: null }),
    });
    expect(response.status).toBe(200);
    expect(saveGraph).toHaveBeenCalledWith(workspaceId, userId, projectId, graph, null);
  });

  it('saves branching and merging agents across an expanded canvas', async () => {
    const ids = [1, 2, 3, 4].map((n) => `00000000-0000-4000-8000-00000000000${n}`);
    const graph: WorkflowGraph = {
      nodes: ids.map((id, index) => ({
        id,
        kind: 'agent',
        label: `Agent ${index}`,
        description: '',
        x: -200 + index * 5000,
        y: -100,
      })),
      edges: [
        [0, 1],
        [0, 2],
        [1, 3],
        [2, 3],
      ].map(([source, target], index) => ({
        id: `10000000-0000-4000-8000-00000000000${index}`,
        source: ids[source!]!,
        target: ids[target!]!,
      })),
    };
    const saveGraph = vi.fn(async () => ({ graph, updatedAt: '2026-10-19T00:00:00.000Z' }));
    const base = await start({ saveGraph });
    const response = await fetch(`${base}/v1/projects/${projectId}/graph`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ graph, expectedUpdatedAt: null }),
    });
    expect(response.status).toBe(200);
    expect(saveGraph).toHaveBeenCalledWith(workspaceId, userId, projectId, graph, null);
  });

  it('saves branch dispatch mode and a person-defined route order', async () => {
    const first = '55555555-5555-4555-8555-555555555555';
    const second = '66666666-6666-4666-8666-666666666666';
    const graph: WorkflowGraph = {
      nodes: [
        {
          id: projectId,
          kind: 'agent',
          label: 'Romy',
          description: '',
          branchMode: 'sequential',
          x: 0,
          y: 0,
        },
        { id: first, kind: 'agent', label: 'Simmy', description: '', x: 300, y: 0 },
        { id: second, kind: 'review', label: 'Human review', description: '', x: 600, y: 0 },
      ],
      edges: [
        { id: '11111111-1111-4111-8111-111111111111', source: projectId, target: first, order: 2 },
        { id: '22222222-2222-4222-8222-222222222222', source: projectId, target: second, order: 1 },
      ],
    };
    const saveGraph = vi.fn(async () => ({ graph, updatedAt: '2026-10-19T00:00:00.000Z' }));
    const base = await start({ saveGraph });
    const response = await fetch(`${base}/v1/projects/${projectId}/graph`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ graph, expectedUpdatedAt: null }),
    });
    expect(response.status).toBe(200);
    expect(saveGraph).toHaveBeenCalledWith(workspaceId, userId, projectId, graph, null);
  });

  it('keeps stale workflow edits from overwriting a newer draft', async () => {
    const base = await start({
      saveGraph: vi.fn(async () => {
        throw new ProjectRevisionConflictError();
      }),
    });
    const response = await fetch(`${base}/v1/projects/${projectId}/graph`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ graph: { nodes: [], edges: [] }, expectedUpdatedAt: null }),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ title: 'Workflow changed in another tab' });
  });
});
