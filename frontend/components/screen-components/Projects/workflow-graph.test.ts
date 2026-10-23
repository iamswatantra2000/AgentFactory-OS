import { describe, expect, it } from 'vitest';
import {
  arrangeGraph,
  connectionError,
  detourPath,
  edgeNeedsDetour,
  ensureBusinessStart,
  factoryRoutePath,
  moveOutgoingRoute,
  normalizeGraph,
  orderedNodes,
  outgoingForwardEdges,
  planFactoryRoutes,
  stageNumbers,
  workflowChecks,
  type Graph,
} from './workflow-graph';

const graph: Graph = {
  nodes: ['leader', 'analyst', 'writer', 'manager'].map((id) => ({
    id,
    kind: 'agent',
    label: id,
    description: '',
    x: 0,
    y: 0,
  })),
  edges: [
    { id: '1', source: 'leader', target: 'analyst' },
    { id: '2', source: 'leader', target: 'writer' },
    { id: '3', source: 'analyst', target: 'manager' },
  ],
};

describe('workflow graph', () => {
  it('allows fan-out and merging into an existing recipient', () => {
    expect(connectionError(graph, 'leader', 'manager')).toBeNull();
    expect(connectionError(graph, 'writer', 'manager')).toBeNull();
  });
  it('allows every operational node type to have multiple incoming and outgoing paths', () => {
    const types = ['agent', 'handoff', 'review', 'output'] as const;
    const typed: Graph = {
      nodes: [
        ...['root-a', 'root-b', 'tail-a', 'tail-b'].map((id) => ({
          id,
          kind: 'agent' as const,
          label: id,
          description: '',
          x: 0,
          y: 0,
        })),
        ...types.map((kind) => ({
          id: kind,
          kind,
          label: kind,
          description: '',
          x: 0,
          y: 0,
        })),
      ],
      edges: [],
    };
    for (const kind of types) {
      for (const source of ['root-a', 'root-b']) {
        expect(connectionError(typed, source, kind)).toBeNull();
        typed.edges.push({ id: `${source}-${kind}`, source, target: kind });
      }
      for (const target of ['tail-a', 'tail-b']) {
        expect(connectionError(typed, kind, target)).toBeNull();
        typed.edges.push({ id: `${kind}-${target}`, source: kind, target });
      }
      expect(typed.edges.filter((edge) => edge.target === kind)).toHaveLength(2);
      expect(typed.edges.filter((edge) => edge.source === kind)).toHaveLength(2);
    }
    expect(orderedNodes(typed)).toHaveLength(typed.nodes.length);
  });
  it('keeps the business start unique, outbound-only, and connected to legacy roots', () => {
    let next = 0;
    const migrated = ensureBusinessStart(graph, () => `new-${++next}`);
    expect(migrated.nodes.filter((node) => node.kind === 'trigger')).toHaveLength(1);
    expect(migrated.nodes.find((node) => node.kind === 'trigger')?.label).toBe('Business brief');
    expect(migrated.edges.some((edge) => edge.source === 'new-1' && edge.target === 'leader')).toBe(
      true,
    );
    expect(connectionError(migrated, 'manager', 'new-1')).toMatch(/starting point/);
    expect(
      workflowChecks(migrated).find(
        (check) => check.label === 'All steps begin at the business brief',
      )?.ready,
    ).toBe(true);
    expect(ensureBusinessStart(migrated, () => 'unused')).toEqual(migrated);
  });
  it('turns an older CEO trigger into an agent without losing its role or routes', () => {
    const old: Graph = {
      nodes: [
        { id: 'ceo', kind: 'trigger', label: 'CEO', description: 'Lead the company', x: 64, y: 64 },
        { id: 'manager', kind: 'agent', label: 'Manager', description: '', x: 356, y: 64 },
      ],
      edges: [{ id: 'route', source: 'ceo', target: 'manager' }],
    };
    const migrated = ensureBusinessStart(normalizeGraph(old), () => 'brief');
    expect(migrated.nodes.find((node) => node.id === 'ceo')).toMatchObject({
      kind: 'agent',
      responsibility: { roleMeaning: 'Lead the company' },
    });
    expect(migrated.edges).toEqual([
      {
        id: 'route',
        source: 'ceo',
        target: 'manager',
        kind: 'forward',
        label: undefined,
        maxRounds: undefined,
        order: undefined,
      },
      { id: 'brief', source: 'brief', target: 'ceo', kind: 'forward', order: 1 },
    ]);
  });
  it('preserves business context and structured decision instructions when normalized', () => {
    const configured = normalizeGraph({
      nodes: [
        {
          id: 'brief',
          kind: 'trigger',
          label: 'Business brief',
          description: '',
          businessPrompt: 'We serve apparel customers.',
          x: 0,
          y: 0,
        },
        {
          id: 'ceo',
          kind: 'agent',
          label: 'CEO',
          description: 'Lead',
          x: 300,
          y: 0,
          responsibility: {
            roleMeaning: 'Set direction',
            work: 'Review proposals',
            decisionProcess: 'Compare options',
            decisionCriteria: 'Maximize customer value',
            handoff: 'Send decision and rationale',
          },
        },
      ],
      edges: [{ id: 'one', source: 'brief', target: 'ceo' }],
    });
    expect(configured.nodes[0]?.businessPrompt).toBe('We serve apparel customers.');
    expect(configured.nodes[1]?.responsibility?.handoff).toBe('Send decision and rationale');
    expect(
      workflowChecks(configured).find((check) => check.label === 'Business brief')?.ready,
    ).toBe(true);
    expect(
      workflowChecks(configured).find((check) => check.label === 'Agent responsibilities')?.ready,
    ).toBe(true);
  });
  it('rejects duplicate connections, self-connections and cycles', () => {
    expect(connectionError(graph, 'leader', 'analyst')).toMatch(/already connected/);
    expect(connectionError(graph, 'leader', 'leader')).toMatch(/different/);
    expect(connectionError(graph, 'manager', 'leader')).toMatch(/loop/);
  });
  it('excludes the previous edge when reconnecting', () => {
    expect(connectionError(graph, 'leader', 'analyst', '1')).toBeNull();
  });
  it('allows a bounded review return without changing forward stages', () => {
    expect(connectionError(graph, 'manager', 'leader', undefined, 'feedback')).toBeNull();
    expect(connectionError(graph, 'writer', 'analyst', undefined, 'feedback')).toMatch(
      /earlier step/,
    );
    const loop: Graph = {
      ...graph,
      edges: [
        ...graph.edges,
        {
          id: 'feedback',
          source: 'manager',
          target: 'leader',
          kind: 'feedback',
          label: 'Recheck the solution',
          maxRounds: 3,
        },
      ],
    };
    expect(stageNumbers(loop)).toEqual(stageNumbers(graph));
    expect(arrangeGraph(loop, 'horizontal').nodes).toEqual(arrangeGraph(graph, 'horizontal').nodes);
    expect(normalizeGraph(loop).edges.at(-1)).toMatchObject({
      kind: 'feedback',
      label: 'Recheck the solution',
      maxRounds: 3,
    });
  });
  it('arranges branches separately and places a merge after every parent', () => {
    const merged = {
      ...graph,
      edges: [...graph.edges, { id: '4', source: 'writer', target: 'manager' }],
    };
    for (const direction of ['horizontal', 'vertical'] as const) {
      const arranged = arrangeGraph(merged, direction);
      const axis = direction === 'horizontal' ? 'x' : 'y';
      for (const edge of arranged.edges) {
        expect(arranged.nodes.find((n) => n.id === edge.target)![axis]).toBeGreaterThan(
          arranged.nodes.find((n) => n.id === edge.source)![axis],
        );
      }
      expect(new Set(arranged.nodes.map((n) => `${n.x}:${n.y}`)).size).toBe(4);
    }
  });
  it('shows a direct branch around an intervening card instead of hiding it', () => {
    const routed: Graph = {
      nodes: ['CEO', 'Romy', 'Simmy', 'Human review', 'Output'].map((label, index) => ({
        id: String(index),
        kind: 'agent' as const,
        label,
        description: '',
        x: 64 + index * 292,
        y: 64,
      })),
      edges: [
        { id: 'ceo', source: '0', target: '1' },
        { id: 'simmy', source: '1', target: '2', order: 1 },
        { id: 'direct', source: '1', target: '3', order: 2 },
        { id: 'review', source: '2', target: '3' },
        { id: 'output', source: '3', target: '4' },
      ],
    };
    expect(edgeNeedsDetour(routed, routed.edges[2]!, 'horizontal')).toBe(true);
    expect(edgeNeedsDetour(routed, routed.edges[1]!, 'horizontal')).toBe(false);
    const path = detourPath(584, 159, 940, 159, 'horizontal', 0);
    expect(path.labelY).toBeLessThan(64);
    expect(path.path).toContain(` ${path.labelY}`);
  });
  it('draws distinct branch corridors and directional return routes', () => {
    const routed: Graph = {
      nodes: ['Brief', 'Romy', 'Simmy', 'Review', 'Output'].map((label, index) => ({
        id: String(index),
        kind: index === 0 ? ('trigger' as const) : ('agent' as const),
        label,
        description: '',
        x: 64 + index * 292,
        y: 144,
      })),
      edges: [
        { id: 'one', source: '0', target: '1' },
        { id: 'two', source: '1', target: '2' },
        { id: 'branch-a', source: '1', target: '3' },
        { id: 'branch-b', source: '1', target: '4' },
        { id: 'return', source: '3', target: '1', kind: 'feedback' },
      ],
    };
    const plans = planFactoryRoutes(routed, 'horizontal');
    expect(plans.get('two')?.kind).toBe('direct');
    expect(plans.get('branch-a')?.kind).toBe('detour');
    expect(plans.get('branch-b')?.kind).toBe('detour');
    expect(plans.get('branch-a')?.corridor).not.toBe(plans.get('branch-b')?.corridor);
    expect(plans.get('return')?.kind).toBe('feedback');
    expect(plans.get('return')!.corridor).toBeLessThan(144);
    const branch = factoryRoutePath(584, 204, 940, 204, plans.get('branch-a')!);
    const feedback = factoryRoutePath(1020, 144, 470, 144, plans.get('return')!);
    expect(branch.path).toContain(`${branch.labelY}`);
    expect(branch.path).toMatch(/^M 584 204/);
    expect(feedback.path).toMatch(/^M 1020 144/);
    expect(feedback.path).toContain('L 470 144');
  });
  it('detours a manually moved forward step that sits behind its source', () => {
    const moved: Graph = {
      nodes: [
        { id: 'first', kind: 'agent', label: 'First', description: '', x: 500, y: 64 },
        { id: 'second', kind: 'agent', label: 'Second', description: '', x: 64, y: 64 },
      ],
      edges: [{ id: 'route', source: 'first', target: 'second' }],
    };
    expect(edgeNeedsDetour(moved, moved.edges[0]!, 'horizontal')).toBe(true);
    expect(planFactoryRoutes(moved, 'horizontal').get('route')?.kind).toBe('detour');
  });
  it('persists and reorders sequential branches without changing their targets', () => {
    const routes: Graph = {
      ...graph,
      nodes: graph.nodes.map((node) => ({ ...node, branchMode: 'sequential' })),
      edges: graph.edges.map((edge, index) => ({ ...edge, order: index + 1 })),
    };
    expect(outgoingForwardEdges(routes, 'leader').map((edge) => edge.target)).toEqual([
      'analyst',
      'writer',
    ]);
    const moved = moveOutgoingRoute(routes, 'leader', '2', -1);
    expect(outgoingForwardEdges(moved, 'leader').map((edge) => edge.target)).toEqual([
      'writer',
      'analyst',
    ]);
    expect(moved.edges).toHaveLength(routes.edges.length);
    expect(normalizeGraph(moved).nodes[0]?.branchMode).toBe('sequential');
    expect(
      normalizeGraph({
        ...moved,
        nodes: moved.nodes.map((node) => ({ ...node, branchMode: 'parallel' })),
      }).nodes[0]?.branchMode,
    ).toBe('parallel');
  });
  it('moves a recipient to a later factory stage when a longer route is connected', () => {
    const before = stageNumbers(graph);
    expect(before.get('manager')).toBe(3);
    const withReview: Graph = {
      nodes: [
        ...graph.nodes,
        { id: 'review', kind: 'review', label: 'Review', description: '', x: 0, y: 0 },
      ],
      edges: [
        ...graph.edges,
        { id: '4', source: 'writer', target: 'review' },
        { id: '5', source: 'review', target: 'manager' },
      ],
    };
    const after = stageNumbers(withReview);
    expect(after.get('manager')).toBe(4);
    const arranged = arrangeGraph(withReview, 'horizontal');
    expect(arranged.nodes.find((node) => node.id === 'manager')!.x).toBeGreaterThan(
      arranged.nodes.find((node) => node.id === 'review')!.x,
    );
  });
  it('does not label disconnected subgraphs as fully connected', () => {
    const disconnected = {
      ...graph,
      edges: [
        { id: '1', source: 'leader', target: 'analyst' },
        { id: '2', source: 'writer', target: 'manager' },
      ],
    };
    expect(
      workflowChecks(disconnected).find((c) => c.label === 'All steps begin at the business brief')
        ?.ready,
    ).toBe(false);
  });
  it('preserves per-agent model settings and flags unconfigured steps', () => {
    const configured = normalizeGraph({
      ...graph,
      nodes: graph.nodes.map((node) => ({
        ...node,
        modelConfig: {
          provider: 'anthropic',
          modelId: 'claude-sonnet-4-5-20250929',
          effort: 'high',
        },
      })),
    });
    expect(configured.nodes[0]?.modelConfig?.effort).toBe('high');
    expect(
      workflowChecks(configured).find((check) => check.label === 'Models assigned')?.ready,
    ).toBe(true);
    expect(workflowChecks(graph).find((check) => check.label === 'Models assigned')?.ready).toBe(
      false,
    );
    const malformed = normalizeGraph({
      ...graph,
      nodes: [
        { ...graph.nodes[0], modelConfig: { provider: 'unknown', modelId: 'x', effort: 'high' } },
      ],
      edges: [],
    });
    expect(malformed.nodes[0]?.modelConfig).toBeUndefined();
  });
});
