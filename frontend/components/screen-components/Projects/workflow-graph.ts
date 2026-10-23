import type { ModelConfig } from './model-catalog';

export type Kind = 'trigger' | 'agent' | 'handoff' | 'review' | 'output';
export type AgentResponsibility = {
  roleMeaning: string;
  work: string;
  decisionProcess: string;
  decisionCriteria: string;
  handoff: string;
};
export type GraphNode = {
  id: string;
  kind: Kind;
  roleKey?: string;
  label: string;
  description: string;
  businessPrompt?: string;
  responsibility?: AgentResponsibility;
  recipientType?: 'person' | 'agent';
  recipientName?: string;
  modelConfig?: ModelConfig;
  branchMode?: 'sequential' | 'parallel';
  x: number;
  y: number;
};
export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  kind?: 'forward' | 'feedback';
  label?: string;
  maxRounds?: number;
  order?: number;
};
export type Graph = { nodes: GraphNode[]; edges: GraphEdge[] };
export type LayoutDirection = 'horizontal' | 'vertical';
export type RouteSide = 'upper' | 'lower';
export type RoutePlan = {
  direction: LayoutDirection;
  kind: 'direct' | 'detour' | 'feedback';
  corridor?: number;
};
export const NODE_WIDTH = 228;
export const NODE_HEIGHT = 190;
export const NODE_LIMIT = 80;
export const EDGE_LIMIT = 160;
export const emptyGraph: Graph = { nodes: [], edges: [] };
export const kindLabels: Record<Kind, string> = {
  agent: 'Agent',
  trigger: 'Business start',
  handoff: 'Handoff',
  review: 'Human review',
  output: 'Output',
};

export function normalizeGraph(value: unknown): Graph {
  if (!value || typeof value !== 'object') return emptyGraph;
  const input = value as Partial<Graph>;
  if (!Array.isArray(input.nodes) || !Array.isArray(input.edges)) return emptyGraph;
  const nodes = input.nodes
    .filter(
      (node): node is GraphNode =>
        typeof node?.id === 'string' &&
        Object.hasOwn(kindLabels, node.kind) &&
        typeof node.label === 'string' &&
        typeof node.description === 'string' &&
        Number.isFinite(node.x) &&
        Number.isFinite(node.y),
    )
    .map((node) => {
      const config = node.modelConfig;
      const validConfig =
        config &&
        ['anthropic', 'openai', 'google'].includes(config.provider) &&
        typeof config.modelId === 'string' &&
        config.modelId.length > 0 &&
        ['low', 'medium', 'high'].includes(config.effort);
      return {
        ...node,
        businessPrompt:
          node.kind === 'trigger' && typeof node.businessPrompt === 'string'
            ? node.businessPrompt.slice(0, 6000)
            : undefined,
        responsibility:
          node.kind === 'agent'
            ? {
                roleMeaning:
                  typeof node.responsibility?.roleMeaning === 'string'
                    ? node.responsibility.roleMeaning.slice(0, 1200)
                    : node.description,
                work:
                  typeof node.responsibility?.work === 'string'
                    ? node.responsibility.work.slice(0, 1200)
                    : '',
                decisionProcess:
                  typeof node.responsibility?.decisionProcess === 'string'
                    ? node.responsibility.decisionProcess.slice(0, 1200)
                    : '',
                decisionCriteria:
                  typeof node.responsibility?.decisionCriteria === 'string'
                    ? node.responsibility.decisionCriteria.slice(0, 1200)
                    : '',
                handoff:
                  typeof node.responsibility?.handoff === 'string'
                    ? node.responsibility.handoff.slice(0, 1200)
                    : '',
              }
            : undefined,
        modelConfig: validConfig ? config : undefined,
        branchMode:
          node.branchMode === 'parallel' ? ('parallel' as const) : ('sequential' as const),
      };
    });
  const ids = new Set(nodes.map((node) => node.id));
  return {
    nodes,
    edges: input.edges
      .filter(
        (edge): edge is GraphEdge =>
          typeof edge?.id === 'string' && ids.has(edge.source) && ids.has(edge.target),
      )
      .map((edge) => ({
        ...edge,
        kind: edge.kind === 'feedback' ? 'feedback' : 'forward',
        label: typeof edge.label === 'string' ? edge.label.slice(0, 120) : undefined,
        maxRounds:
          edge.kind === 'feedback' &&
          Number.isInteger(edge.maxRounds) &&
          (edge.maxRounds ?? 0) >= 1 &&
          (edge.maxRounds ?? 0) <= 5
            ? edge.maxRounds
            : edge.kind === 'feedback'
              ? 2
              : undefined,
        order:
          Number.isInteger(edge.order) && (edge.order ?? 0) >= 1 && (edge.order ?? 0) <= EDGE_LIMIT
            ? edge.order
            : undefined,
      })),
  };
}

/** Upgrade older drafts without losing their agents, routes, or the user's written text. */
export function ensureBusinessStart(graph: Graph, idFactory: () => string): Graph {
  const starts = graph.nodes.filter((node) => node.kind === 'trigger');
  const reusable = starts.find(
    (node) =>
      /^(trigger|business (brief|model|context|start))$/i.test(node.label.trim()) &&
      !graph.edges.some((edge) => edge.target === node.id),
  );
  const otherNodes = graph.nodes.map((node) => {
    if (node.kind !== 'trigger' || node.id === reusable?.id) return node;
    return {
      ...node,
      kind: 'agent' as const,
      roleKey: node.roleKey ?? 'custom-agent',
      responsibility: node.responsibility ?? {
        roleMeaning: node.description,
        work: '',
        decisionProcess: '',
        decisionCriteria: '',
        handoff: '',
      },
      businessPrompt: undefined,
    };
  });
  const roots = otherNodes.filter(
    (node) =>
      node.id !== reusable?.id &&
      !graph.edges.some((edge) => edge.kind !== 'feedback' && edge.target === node.id),
  );
  const start: GraphNode = reusable
    ? {
        ...reusable,
        label: 'Business brief',
        description: '',
        modelConfig: undefined,
        businessPrompt: reusable.businessPrompt ?? reusable.description,
      }
    : {
        id: idFactory(),
        kind: 'trigger',
        label: 'Business brief',
        description: '',
        businessPrompt: '',
        branchMode: 'sequential',
        x: Math.min(0, ...otherNodes.map((node) => node.x - 300)),
        y: roots[0]?.y ?? 64,
      };
  const nodes = reusable
    ? otherNodes.map((node) => (node.id === reusable.id ? start : node))
    : [start, ...otherNodes];
  const edges = graph.edges.filter((edge) => edge.target !== start.id);
  if (!reusable) {
    for (const [index, root] of roots.entries()) {
      edges.push({
        id: idFactory(),
        source: start.id,
        target: root.id,
        kind: 'forward',
        order: index + 1,
      });
    }
  }
  return { nodes, edges };
}

const forwardEdges = (graph: Graph) => graph.edges.filter((edge) => edge.kind !== 'feedback');

/** The saved route order is the dispatch order for a sequential branch. */
export function outgoingForwardEdges(graph: Graph, source: string) {
  return forwardEdges(graph)
    .map((edge, index) => ({ edge, index }))
    .filter(({ edge }) => edge.source === source)
    .sort(
      (a, b) => (a.edge.order ?? a.index + 1) - (b.edge.order ?? b.index + 1) || a.index - b.index,
    )
    .map(({ edge }) => edge);
}

export function moveOutgoingRoute(
  graph: Graph,
  source: string,
  edgeId: string,
  direction: -1 | 1,
): Graph {
  const routes = outgoingForwardEdges(graph, source);
  const index = routes.findIndex((edge) => edge.id === edgeId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= routes.length) return graph;
  [routes[index], routes[nextIndex]] = [routes[nextIndex]!, routes[index]!];
  const rank = new Map(routes.map((edge, position) => [edge.id, position + 1]));
  return {
    ...graph,
    edges: graph.edges.map((edge) =>
      rank.has(edge.id) ? { ...edge, order: rank.get(edge.id) } : edge,
    ),
  };
}

/** A long branch must leave the center line when it would pass through another card. */
export function edgeNeedsDetour(
  graph: Graph,
  edge: GraphEdge,
  direction: LayoutDirection,
  stages = stageNumbers(graph),
) {
  if (edge.kind === 'feedback') return false;
  const source = graph.nodes.find((node) => node.id === edge.source);
  const target = graph.nodes.find((node) => node.id === edge.target);
  if (!source || !target) return false;
  if ((stages.get(target.id) ?? 0) - (stages.get(source.id) ?? 0) > 1) return true;
  const horizontal = direction === 'horizontal';
  const start = horizontal ? source.x + NODE_WIDTH : source.y + NODE_HEIGHT;
  const end = horizontal ? target.x : target.y;
  if (end <= start) return true;
  const startCross = horizontal ? source.y + NODE_HEIGHT / 2 : source.x + NODE_WIDTH / 2;
  const endCross = horizontal ? target.y + NODE_HEIGHT / 2 : target.x + NODE_WIDTH / 2;
  return graph.nodes.some((node) => {
    if (node.id === source.id || node.id === target.id) return false;
    const alongStart = horizontal ? node.x : node.y;
    const alongEnd = alongStart + (horizontal ? NODE_WIDTH : NODE_HEIGHT);
    if (alongEnd < start || alongStart > end) return false;
    const progress =
      (Math.max(start, Math.min(end, (alongStart + alongEnd) / 2)) - start) / (end - start);
    const cross = startCross + (endCross - startCross) * progress;
    const crossStart = horizontal ? node.y : node.x;
    const crossEnd = crossStart + (horizontal ? NODE_HEIGHT : NODE_WIDTH);
    return cross >= crossStart - 18 && cross <= crossEnd + 18;
  });
}

export function detourPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  direction: LayoutDirection,
  lane: number,
) {
  const offset = 72 + lane * 48;
  if (direction === 'horizontal') {
    const laneY = Math.min(sourceY, targetY) - NODE_HEIGHT / 2 - offset;
    const path = `M ${sourceX} ${sourceY} C ${sourceX + 42} ${sourceY}, ${sourceX + 42} ${laneY}, ${sourceX + 84} ${laneY} L ${targetX - 84} ${laneY} C ${targetX - 42} ${laneY}, ${targetX - 42} ${targetY}, ${targetX} ${targetY}`;
    return { path, labelX: (sourceX + targetX) / 2, labelY: laneY };
  }
  const laneX = Math.min(sourceX, targetX) - NODE_WIDTH / 2 - offset;
  const path = `M ${sourceX} ${sourceY} C ${sourceX} ${sourceY + 42}, ${laneX} ${sourceY + 42}, ${laneX} ${sourceY + 84} L ${laneX} ${targetY - 84} C ${laneX} ${targetY - 42}, ${targetX} ${targetY - 42}, ${targetX} ${targetY}`;
  return { path, labelX: laneX, labelY: (sourceY + targetY) / 2 };
}

function roundedPolyline(points: [number, number][], radius = 12) {
  const visible = points.filter(
    (point, index) =>
      index === 0 || point[0] !== points[index - 1]![0] || point[1] !== points[index - 1]![1],
  );
  if (visible.length < 2) return '';
  let path = `M ${visible[0]![0]} ${visible[0]![1]}`;
  for (let index = 1; index < visible.length - 1; index++) {
    const previous = visible[index - 1]!;
    const corner = visible[index]!;
    const next = visible[index + 1]!;
    const incoming = Math.hypot(corner[0] - previous[0], corner[1] - previous[1]);
    const outgoing = Math.hypot(next[0] - corner[0], next[1] - corner[1]);
    const bend = Math.min(radius, incoming / 2, outgoing / 2);
    const entry: [number, number] = [
      corner[0] - ((corner[0] - previous[0]) / incoming) * bend,
      corner[1] - ((corner[1] - previous[1]) / incoming) * bend,
    ];
    const exit: [number, number] = [
      corner[0] + ((next[0] - corner[0]) / outgoing) * bend,
      corner[1] + ((next[1] - corner[1]) / outgoing) * bend,
    ];
    path += ` L ${entry[0]} ${entry[1]} Q ${corner[0]} ${corner[1]} ${exit[0]} ${exit[1]}`;
  }
  const last = visible.at(-1)!;
  return `${path} L ${last[0]} ${last[1]}`;
}

/** Rounded, directional routes keep every branch separate and readable. */
export function factoryRoutePath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  plan: RoutePlan,
) {
  const horizontal = plan.direction === 'horizontal';
  const stem = 24;
  let points: [number, number][];
  let labelX: number;
  let labelY: number;
  if (plan.kind === 'feedback') {
    const corridor =
      plan.corridor ??
      (horizontal ? Math.min(sourceY, targetY) - 60 : Math.min(sourceX, targetX) - 60);
    points = horizontal
      ? [
          [sourceX, sourceY],
          [sourceX, corridor],
          [targetX, corridor],
          [targetX, targetY],
        ]
      : [
          [sourceX, sourceY],
          [corridor, sourceY],
          [corridor, targetY],
          [targetX, targetY],
        ];
    labelX = horizontal ? (sourceX + targetX) / 2 : corridor;
    labelY = horizontal ? corridor : (sourceY + targetY) / 2;
  } else if (plan.kind === 'detour') {
    const corridor =
      plan.corridor ??
      (horizontal ? Math.min(sourceY, targetY) - 72 : Math.min(sourceX, targetX) - 72);
    points = horizontal
      ? [
          [sourceX, sourceY],
          [sourceX + stem, sourceY],
          [sourceX + stem, corridor],
          [targetX - stem, corridor],
          [targetX - stem, targetY],
          [targetX, targetY],
        ]
      : [
          [sourceX, sourceY],
          [sourceX, sourceY + stem],
          [corridor, sourceY + stem],
          [corridor, targetY - stem],
          [targetX, targetY - stem],
          [targetX, targetY],
        ];
    labelX = horizontal ? (sourceX + targetX) / 2 : corridor;
    labelY = horizontal ? corridor : (sourceY + targetY) / 2;
  } else {
    const middle = horizontal ? (sourceX + targetX) / 2 : (sourceY + targetY) / 2;
    points = horizontal
      ? [
          [sourceX, sourceY],
          [middle, sourceY],
          [middle, targetY],
          [targetX, targetY],
        ]
      : [
          [sourceX, sourceY],
          [sourceX, middle],
          [targetX, middle],
          [targetX, targetY],
        ];
    labelX = horizontal ? middle : (sourceX + targetX) / 2;
    labelY = horizontal ? (sourceY + targetY) / 2 : middle;
  }
  return { path: roundedPolyline(points), labelX, labelY };
}

/** Reserve distinct outer corridors for routes whose node spans overlap. */
export function planFactoryRoutes(
  graph: Graph,
  direction: LayoutDirection,
  stages = stageNumbers(graph),
) {
  const horizontal = direction === 'horizontal';
  const plans = new Map<string, RoutePlan>();
  const occupied: Record<RouteSide | 'feedback', number[]> = {
    upper: [],
    lower: [],
    feedback: [],
  };
  let sameLineDetours = 0;
  for (const edge of graph.edges) {
    const source = graph.nodes.find((node) => node.id === edge.source);
    const target = graph.nodes.find((node) => node.id === edge.target);
    if (!source || !target) continue;
    const feedback = edge.kind === 'feedback';
    const detour = !feedback && edgeNeedsDetour(graph, edge, direction, stages);
    if (!feedback && !detour) {
      plans.set(edge.id, { direction, kind: 'direct' });
      continue;
    }
    const sourceCross = horizontal ? source.y : source.x;
    const targetCross = horizontal ? target.y : target.x;
    const side: RouteSide | 'feedback' = feedback
      ? 'feedback'
      : targetCross > sourceCross + 24
        ? 'lower'
        : targetCross < sourceCross - 24
          ? 'upper'
          : sameLineDetours++ % 2 === 0
            ? 'upper'
            : 'lower';
    const spanStart = Math.min(horizontal ? source.x : source.y, horizontal ? target.x : target.y);
    const spanEnd =
      Math.max(horizontal ? source.x : source.y, horizontal ? target.x : target.y) +
      (horizontal ? NODE_WIDTH : NODE_HEIGHT);
    const lanes = occupied[side];
    let lane = lanes.findIndex((end) => end + 32 < spanStart);
    if (lane < 0) lane = lanes.length;
    lanes[lane] = spanEnd;
    const across = graph.nodes.filter((node) => {
      const start = horizontal ? node.x : node.y;
      return start < spanEnd && start + (horizontal ? NODE_WIDTH : NODE_HEIGHT) > spanStart;
    });
    const crossMin = Math.min(...across.map((node) => (horizontal ? node.y : node.x)));
    const crossMax = Math.max(
      ...across.map((node) => (horizontal ? node.y + NODE_HEIGHT : node.x + NODE_WIDTH)),
    );
    const corridor =
      side === 'lower'
        ? crossMax + 44 + lane * 42
        : crossMin - 44 - lane * 42 - (side === 'feedback' ? 38 : 0);
    plans.set(edge.id, { direction, kind: feedback ? 'feedback' : 'detour', corridor });
  }
  return plans;
}

function pathExists(edges: GraphEdge[], start: string, end: string) {
  const seen = new Set<string>();
  const pending = [start];
  while (pending.length) {
    const id = pending.pop()!;
    if (id === end) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    pending.push(...edges.filter((edge) => edge.source === id).map((edge) => edge.target));
  }
  return false;
}

/** Forward routes form a DAG. A bounded feedback route returns to an upstream step. */
export function connectionError(
  graph: Graph,
  source: string,
  target: string,
  replacingId?: string,
  kind: 'forward' | 'feedback' = 'forward',
) {
  if (
    !graph.nodes.some((node) => node.id === source) ||
    !graph.nodes.some((node) => node.id === target)
  )
    return 'Choose two steps on the canvas.';
  if (source === target) return 'Connect to a different step.';
  if (graph.nodes.find((node) => node.id === target)?.kind === 'trigger')
    return 'The business brief is the starting point and cannot receive a connection.';
  const edges = graph.edges.filter((edge) => edge.id !== replacingId);
  if (edges.some((edge) => edge.source === source && edge.target === target))
    return 'These steps are already connected. You can connect this agent to another step.';
  if (!replacingId && edges.length >= EDGE_LIMIT)
    return 'This workflow has reached its 160-connection limit.';
  const forward = edges.filter((edge) => edge.kind !== 'feedback');
  if (kind === 'feedback') {
    if (!pathExists(forward, target, source))
      return 'A review loop must return to an earlier step on this agent’s production path.';
  } else if (pathExists(forward, target, source))
    return 'This would loop back to an earlier step. Use a review loop for a bounded conversation.';
  return null;
}

export function orderedNodes(graph: Graph) {
  const routes = forwardEdges(graph);
  const incoming = new Map(graph.nodes.map((node) => [node.id, 0]));
  for (const edge of routes) incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
  const pending = graph.nodes.filter((node) => incoming.get(node.id) === 0);
  const result: GraphNode[] = [];
  while (pending.length) {
    const node = pending.shift()!;
    result.push(node);
    for (const edge of outgoingForwardEdges(graph, node.id)) {
      const remaining = (incoming.get(edge.target) ?? 0) - 1;
      incoming.set(edge.target, remaining);
      if (remaining === 0) {
        const target = graph.nodes.find((item) => item.id === edge.target);
        if (target) pending.push(target);
      }
    }
  }
  return result.length === graph.nodes.length ? result : graph.nodes;
}

/** A step's stage is one beyond its latest parent, so merges wait for every input. */
export function stageNumbers(graph: Graph) {
  const stages = new Map<string, number>();
  for (const node of orderedNodes(graph)) {
    const parents = forwardEdges(graph).filter((edge) => edge.target === node.id);
    stages.set(
      node.id,
      parents.reduce((latest, edge) => Math.max(latest, (stages.get(edge.source) ?? 0) + 1), 1),
    );
  }
  return stages;
}

/** Place every step after all of its parents, with separate lanes for parallel branches. */
export function arrangeGraph(graph: Graph, direction: LayoutDirection): Graph {
  const stages = stageNumbers(graph);
  const levels = new Map<number, GraphNode[]>();
  for (const node of orderedNodes(graph)) {
    const rank = (stages.get(node.id) ?? 1) - 1;
    levels.set(rank, [...(levels.get(rank) ?? []), node]);
  }
  const widest = Math.max(1, ...[...levels.values()].map((level) => level.length));
  const positions = new Map<string, { x: number; y: number }>();
  for (const [rank, level] of levels) {
    const offset = (widest - level.length) / 2;
    level.forEach((node, index) => {
      positions.set(
        node.id,
        direction === 'horizontal'
          ? { x: 64 + rank * 292, y: 64 + (index + offset) * 228 }
          : { x: 64 + (index + offset) * 300, y: 64 + rank * 264 },
      );
    });
  }
  return { ...graph, nodes: graph.nodes.map((node) => ({ ...node, ...positions.get(node.id)! })) };
}

export function workflowChecks(graph: Graph) {
  const starts = graph.nodes.filter((node) => node.kind === 'trigger');
  const start = starts[0];
  const connected = new Set<string>();
  const pending = start ? [start.id] : [];
  while (pending.length) {
    const id = pending.pop()!;
    if (connected.has(id)) continue;
    connected.add(id);
    for (const edge of graph.edges)
      if (edge.source === id && edge.kind !== 'feedback') pending.push(edge.target);
  }
  return [
    {
      label: 'Business brief',
      ready: starts.length === 1 && Boolean(start?.businessPrompt?.trim()),
    },
    {
      label: 'Agent responsibilities',
      ready:
        graph.nodes.some((node) => node.kind === 'agent') &&
        graph.nodes
          .filter((node) => node.kind === 'agent')
          .every((node) => {
            const responsibility = node.responsibility;
            return Boolean(
              responsibility?.roleMeaning.trim() &&
              responsibility.work.trim() &&
              responsibility.decisionProcess.trim() &&
              responsibility.decisionCriteria.trim() &&
              responsibility.handoff.trim(),
            );
          }),
    },
    {
      label: 'Models assigned',
      ready:
        graph.nodes.some((node) => node.kind !== 'trigger') &&
        graph.nodes
          .filter((node) => node.kind !== 'trigger')
          .every((node) => Boolean(node.modelConfig?.modelId)),
    },
    {
      label: 'All steps begin at the business brief',
      ready: graph.nodes.length > 1 && graph.nodes.every((node) => connected.has(node.id)),
    },
    {
      label: 'Handoff recipients named',
      ready: graph.nodes.every(
        (node) => node.kind !== 'handoff' || Boolean(node.recipientName?.trim()),
      ),
    },
    { label: 'Human review checkpoint', ready: graph.nodes.some((node) => node.kind === 'review') },
    { label: 'Final output', ready: graph.nodes.some((node) => node.kind === 'output') },
  ];
}
