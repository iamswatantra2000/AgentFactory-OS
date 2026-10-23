'use client';

import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  MarkerType,
  ReactFlow,
  type Connection,
  type Edge,
  type NodeChange,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ArrowCounterClockwiseIcon,
  ArrowClockwiseIcon,
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ArrowsInIcon,
  ArrowsOutIcon,
  CheckCircleIcon,
  CopyIcon,
  FloppyDiskIcon,
  FrameCornersIcon,
  GitBranchIcon,
  InfoIcon,
  MagnifyingGlassIcon,
  MinusIcon,
  PlayIcon,
  PlusIcon,
  RobotIcon,
  TrashIcon,
  TreeStructureIcon,
  WarningCircleIcon,
  XIcon,
} from '@phosphor-icons/react';
import type { Project } from '@/server/projects';
import { roleIcons, WorkflowNode, type WorkflowCanvasNode } from './WorkflowNode';
import { WorkflowRoute } from './WorkflowRoute';
import {
  modelCatalog,
  modelName,
  providers,
  type ModelEffort,
  type ModelProvider,
} from './model-catalog';
import {
  arrangeGraph,
  connectionError,
  EDGE_LIMIT,
  emptyGraph,
  ensureBusinessStart,
  kindLabels,
  NODE_HEIGHT,
  NODE_LIMIT,
  NODE_WIDTH,
  normalizeGraph,
  orderedNodes,
  outgoingForwardEdges,
  planFactoryRoutes,
  moveOutgoingRoute,
  stageNumbers,
  workflowChecks,
  type Graph,
  type GraphEdge,
  type GraphNode,
  type Kind,
  type LayoutDirection,
} from './workflow-graph';
import styles from './factory.module.css';

const nodeTypes = { workflow: WorkflowNode };
const edgeTypes = { factoryRoute: WorkflowRoute };
const presets: { key: keyof typeof roleIcons; kind: Kind; name: string; description: string }[] = [
  {
    key: 'custom-agent',
    kind: 'agent',
    name: 'Custom agent',
    description: 'Define a CEO, manager, or specialist role.',
  },
  {
    key: 'data-analyst',
    kind: 'agent',
    name: 'Data Analyst',
    description: 'Analyze data and surface useful findings.',
  },
  {
    key: 'research-writer',
    kind: 'agent',
    name: 'Research Writer',
    description: 'Research, summarize, and prepare reports.',
  },
  {
    key: 'visual-creator',
    kind: 'agent',
    name: 'Visual Creator',
    description: 'Create charts and visual deliverables.',
  },
  {
    key: 'support-agent',
    kind: 'agent',
    name: 'Support Agent',
    description: 'Organize and resolve customer requests.',
  },
  {
    key: 'handoff',
    kind: 'handoff',
    name: 'Handoff',
    description: 'Send findings to a person or another agent.',
  },
  {
    key: 'review',
    kind: 'review',
    name: 'Human review',
    description: 'Add a human approval checkpoint.',
  },
  {
    key: 'output',
    kind: 'output',
    name: 'Output',
    description: 'Define the final result of this workflow.',
  },
];
const duration = () => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220);
const fingerprint = (graph: Graph) => JSON.stringify(graph);

export function VisualFactory({ project }: { project: Project }) {
  const [graph, setGraph] = useState<Graph>(emptyGraph);
  const [saved, setSaved] = useState(fingerprint(emptyGraph));
  const [past, setPast] = useState<Graph[]>([]);
  const [future, setFuture] = useState<Graph[]>([]);
  const [revision, setRevision] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [panel, setPanel] = useState<'library' | 'details'>('library');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [direction, setDirection] = useState<LayoutDirection>('horizontal');
  const [autoArrange, setAutoArrange] = useState(true);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [preview, setPreview] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [flow, setFlow] = useState<ReactFlowInstance<WorkflowCanvasNode, Edge> | null>(null);
  const [connectingSource, setConnectingSource] = useState<string | null>(null);
  const [connectTarget, setConnectTarget] = useState('');
  const [feedbackTarget, setFeedbackTarget] = useState('');
  const reconnecting = useRef<string | null>(null);
  const dragOrigin = useRef<Graph | null>(null);
  const editGroup = useRef<string | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const reviewDialog = useRef<HTMLDialogElement>(null);
  const readOnly = project.status !== 'active' || !['owner', 'admin'].includes(project.role);
  const locked = readOnly || loading || saving || loadFailed;
  const dirty = fingerprint(graph) !== saved;
  const selected = graph.nodes.find((node) => node.id === selectedId);
  const selectedEdge = graph.edges.find((edge) => edge.id === selectedEdgeId);
  const checks = workflowChecks(graph);
  const readyCount = checks.filter((check) => check.ready).length;
  const productionOrder = useMemo(() => orderedNodes(graph), [graph]);
  const stages = useMemo(() => stageNumbers(graph), [graph]);
  const routePlans = useMemo(
    () => planFactoryRoutes(graph, direction, stages),
    [graph, direction, stages],
  );
  const touringNode = tourStep === null ? null : productionOrder[tourStep];
  const visited = useMemo(
    () => new Set(productionOrder.slice(0, (tourStep ?? -1) + 1).map((node) => node.id)),
    [productionOrder, tourStep],
  );
  const incoming = graph.edges.filter((edge) => edge.target === selectedId);
  const outgoing = selectedId
    ? [
        ...outgoingForwardEdges(graph, selectedId),
        ...graph.edges.filter((edge) => edge.source === selectedId && edge.kind === 'feedback'),
      ]
    : [];
  const filtered = presets.filter(
    (preset) =>
      (category === 'All' ||
        (category === 'Agents' ? preset.kind === 'agent' : preset.kind !== 'agent')) &&
      (preset.name + ' ' + preset.description).toLowerCase().includes(query.toLowerCase()),
  );
  const nodes = useMemo<WorkflowCanvasNode[]>(
    () =>
      graph.nodes.map((step) => {
        const incomingForwardIds = graph.edges
          .filter((edge) => edge.target === step.id && edge.kind !== 'feedback')
          .map((edge) => edge.id);
        const outgoingForwardIds = outgoingForwardEdges(graph, step.id).map((edge) => edge.id);
        const incomingFeedbackIds = graph.edges
          .filter((edge) => edge.target === step.id && edge.kind === 'feedback')
          .map((edge) => edge.id);
        const outgoingFeedbackIds = graph.edges
          .filter((edge) => edge.source === step.id && edge.kind === 'feedback')
          .map((edge) => edge.id);
        return {
          id: step.id,
          type: 'workflow',
          position: { x: step.x, y: step.y },
          selected: step.id === selectedId,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          ariaLabel: step.label + ', ' + kindLabels[step.kind] + '. Select to edit details.',
          data: {
            step,
            direction,
            incoming: graph.edges.filter((edge) => edge.target === step.id).length,
            outgoing: graph.edges.filter((edge) => edge.source === step.id).length,
            forwardOutgoing: outgoingForwardEdges(graph, step.id).length,
            incomingForwardIds,
            outgoingForwardIds,
            incomingFeedbackIds,
            outgoingFeedbackIds,
            portSignature: [
              ...incomingForwardIds,
              ...outgoingForwardIds,
              ...incomingFeedbackIds,
              ...outgoingFeedbackIds,
            ].join('|'),
            stage: stages.get(step.id) ?? 1,
            touring: touringNode?.id === step.id,
            visited: tourStep !== null && visited.has(step.id),
            connecting: Boolean(connectingSource),
            validTarget: Boolean(
              connectingSource &&
              (!connectionError(graph, connectingSource, step.id) ||
                !connectionError(graph, connectingSource, step.id, undefined, 'feedback')),
            ),
          },
        };
      }),
    [graph, selectedId, direction, connectingSource, stages, tourStep, touringNode?.id, visited],
  );
  const edges = useMemo<Edge[]>(
    () =>
      graph.edges.map((edge, index) => {
        const active = edge.id === selectedEdgeId;
        const related = !selectedId || edge.source === selectedId || edge.target === selectedId;
        const feedback = edge.kind === 'feedback';
        const source = graph.nodes.find((node) => node.id === edge.source);
        const dispatch = source?.branchMode ?? 'sequential';
        const plan = routePlans.get(edge.id) ?? { direction, kind: 'direct' as const };
        const color = active ? '#945a16' : feedback ? '#b77d37' : related ? '#2d7051' : '#b7c6bb';
        return {
          ...edge,
          type: 'factoryRoute',
          data: plan,
          sourceHandle: feedback ? `feedback-out:${edge.id}` : `out:${edge.id}`,
          targetHandle: feedback ? `feedback-in:${edge.id}` : `in:${edge.id}`,
          label: feedback ? `↩ ${index + 1}` : `${index + 1}${dispatch === 'parallel' ? ' ∥' : ''}`,
          labelStyle: { fill: feedback ? '#724719' : '#1d573c', fontSize: 14, fontWeight: 700 },
          labelBgStyle: {
            fill: feedback ? '#fff6e7' : '#f8fff7',
            stroke: feedback ? '#d8ad73' : '#81ae8e',
            strokeWidth: 1,
          },
          labelBgPadding: [7, 5],
          labelBgBorderRadius: 5,
          selected: active,
          animated:
            !feedback && tourStep !== null && visited.has(edge.source) && visited.has(edge.target),
          interactionWidth: 28,
          style: {
            stroke: color,
            strokeWidth: active ? 3.75 : plan.kind === 'detour' ? 3 : 2.5,
            strokeDasharray: feedback ? '7 5' : undefined,
          },
          markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color },
          ariaLabel:
            (feedback
              ? 'Review loop from '
              : plan.kind === 'detour'
                ? 'Visible branch from '
                : 'Connection from ') +
            (graph.nodes.find((node) => node.id === edge.source)?.label ?? '') +
            ' to ' +
            (graph.nodes.find((node) => node.id === edge.target)?.label ?? ''),
        };
      }),
    [graph, selectedEdgeId, selectedId, tourStep, visited, direction, routePlans],
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadFailed(false);
    fetch('/api/projects/' + project.id + '/graph', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error('Could not load this workflow. Try again to continue editing.');
        return response.json() as Promise<{ graph: unknown; updatedAt: string | null }>;
      })
      .then((result) => {
        const normalized = normalizeGraph(result.graph);
        const next = ensureBusinessStart(normalized, () => crypto.randomUUID());
        setGraph(next);
        setSaved(fingerprint(normalized));
        setRevision(result.updatedAt);
        setPast([]);
        setFuture([]);
        setTourStep(null);
        setError('');
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : 'Workflow unavailable.');
        setLoadFailed(true);
        setLoading(false);
      });
    return () => controller.abort();
  }, [project.id, loadAttempt]);

  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => event.preventDefault();
    const guardLinks = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor =
        event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (
        !anchor ||
        anchor.target === '_blank' ||
        new URL(anchor.href).pathname === window.location.pathname
      )
        return;
      if (!window.confirm('Leave the playground without saving your workflow changes?')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', guard);
    document.addEventListener('click', guardLinks, true);
    return () => {
      window.removeEventListener('beforeunload', guard);
      document.removeEventListener('click', guardLinks, true);
    };
  }, [dirty]);

  useEffect(() => {
    if (preview) reviewDialog.current?.showModal();
    else reviewDialog.current?.close();
  }, [preview]);
  useEffect(() => {
    if (tourStep === null) return;
    const timer = window.setTimeout(
      () =>
        setTourStep((current) =>
          current === null || current + 1 >= productionOrder.length ? null : current + 1,
        ),
      1100,
    );
    return () => window.clearTimeout(timer);
  }, [tourStep, productionOrder.length]);
  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !reviewDialog.current?.open) setExpanded(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [expanded]);

  function commit(next: Graph, group?: string) {
    if (locked || fingerprint(next) === fingerprint(graph)) return;
    setTourStep(null);
    if (!group || editGroup.current !== group) setPast((current) => [...current.slice(-49), graph]);
    editGroup.current = group ?? null;
    setFuture([]);
    setGraph(next);
    setMessage('');
    setError('');
  }
  function selectNode(id: string, openDetails = true) {
    setTourStep(null);
    setSelectedId(id);
    setSelectedEdgeId(null);
    setConnectTarget('');
    setFeedbackTarget('');
    editGroup.current = null;
    if (openDetails) setPanel('details');
  }
  function selectEdge(id: string) {
    setTourStep(null);
    setSelectedEdgeId(id);
    setSelectedId(null);
    setPanel('details');
    editGroup.current = null;
  }
  function fitAll() {
    void flow?.fitView({ padding: 0.18, maxZoom: 1, duration: duration() });
  }
  function applyFactoryLayout(next: Graph) {
    if (!autoArrange) return next;
    requestAnimationFrame(() => requestAnimationFrame(fitAll));
    return arrangeGraph(next, direction);
  }
  function revealNode(node: GraphNode) {
    void flow?.setCenter(node.x + NODE_WIDTH / 2, node.y + NODE_HEIGHT / 2, {
      zoom: 1,
      duration: duration(),
    });
  }
  function openLibrary() {
    setPanel('library');
    requestAnimationFrame(() => search.current?.focus());
  }
  function addNode(key: string, location?: { x: number; y: number }) {
    if (locked) return;
    if (graph.nodes.length >= NODE_LIMIT) {
      setError('This workflow has reached its 80-step limit.');
      return;
    }
    const preset = presets.find((item) => item.key === key);
    if (!preset) return;
    const rect = canvas.current?.getBoundingClientRect();
    const center =
      rect && flow
        ? flow.screenToFlowPosition({
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          })
        : { x: 300, y: 200 };
    let position = location ?? { x: center.x - NODE_WIDTH / 2, y: center.y - NODE_HEIGHT / 2 };
    while (
      graph.nodes.some(
        (node) => Math.abs(node.x - position.x) < 35 && Math.abs(node.y - position.y) < 35,
      )
    )
      position = { x: position.x + 40, y: position.y + 48 };
    const node: GraphNode = {
      id: crypto.randomUUID(),
      kind: preset.kind,
      label: preset.name,
      description: preset.description,
      branchMode: 'sequential',
      ...(preset.kind === 'agent' ? { roleKey: preset.key } : {}),
      ...(preset.kind === 'agent'
        ? {
            responsibility: {
              roleMeaning: '',
              work: '',
              decisionProcess: '',
              decisionCriteria: '',
              handoff: '',
            },
          }
        : {}),
      ...(preset.kind === 'handoff' ? { recipientType: 'person' as const, recipientName: '' } : {}),
      x: Math.round(position.x),
      y: Math.round(position.y),
    };
    commit({ ...graph, nodes: [...graph.nodes, node] });
    selectNode(node.id, !location);
  }
  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const key = event.dataTransfer.getData('application/x-agentfactory-node');
    if (!key || !flow) return;
    const position = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    addNode(key, { x: position.x - NODE_WIDTH / 2, y: position.y - 40 });
  }
  function connect(
    connection: Pick<Connection, 'source' | 'target'> & { targetHandle?: string | null },
    replacingId?: string,
  ) {
    if (locked) return;
    const kind = connection.targetHandle?.startsWith('feedback-in') ? 'feedback' : 'forward';
    const reason = connectionError(graph, connection.source, connection.target, replacingId, kind);
    if (reason) {
      setError(reason);
      return;
    }
    const previous = graph.edges.find((item) => item.id === replacingId);
    const nextOrder =
      Math.max(
        0,
        ...graph.edges.map((item, index) =>
          item.id !== replacingId && item.source === connection.source && item.kind !== 'feedback'
            ? (item.order ?? index + 1)
            : 0,
        ),
      ) + 1;
    const edge: GraphEdge = {
      id: replacingId ?? crypto.randomUUID(),
      source: connection.source,
      target: connection.target,
      kind,
      ...(kind === 'forward'
        ? {
            order:
              previous?.kind !== 'feedback' && previous?.source === connection.source
                ? (previous?.order ?? graph.edges.findIndex((item) => item.id === replacingId) + 1)
                : nextOrder,
          }
        : {}),
      ...(kind === 'feedback'
        ? {
            label: previous?.kind === 'feedback' ? previous.label : 'Review the solution',
            maxRounds: previous?.maxRounds ?? 2,
          }
        : {}),
    };
    commit(
      applyFactoryLayout({
        ...graph,
        edges: replacingId
          ? graph.edges.map((item) => (item.id === replacingId ? edge : item))
          : [...graph.edges, edge],
      }),
    );
    setConnectTarget('');
    setFeedbackTarget('');
    setMessage(
      kind === 'feedback'
        ? 'Review loop added. The return path is shown in amber and limited to two rounds by default.'
        : autoArrange
          ? 'Connection added. The production line was rearranged.'
          : 'Connection added. Drag cards to set their positions.',
    );
  }
  function removeEdge(id: string) {
    commit(applyFactoryLayout({ ...graph, edges: graph.edges.filter((edge) => edge.id !== id) }));
    setSelectedEdgeId(null);
  }
  function removeNode() {
    if (!selected || selected.kind === 'trigger') return;
    commit(
      applyFactoryLayout({
        nodes: graph.nodes.filter((node) => node.id !== selected.id),
        edges: graph.edges.filter(
          (edge) => edge.source !== selected.id && edge.target !== selected.id,
        ),
      }),
    );
    setSelectedId(null);
    setMessage('Step removed. Undo restores it and its connections.');
  }
  function updateNode(patch: Partial<GraphNode>, group: string) {
    if (!selected) return;
    commit(
      {
        ...graph,
        nodes: graph.nodes.map((node) => (node.id === selected.id ? { ...node, ...patch } : node)),
      },
      selected.id + ':' + group,
    );
  }
  function duplicateNode() {
    if (!selected || selected.kind === 'trigger' || graph.nodes.length >= NODE_LIMIT) return;
    const node = {
      ...selected,
      id: crypto.randomUUID(),
      label: (selected.label + ' copy').slice(0, 100),
      x: selected.x + 48,
      y: selected.y + 200,
    };
    commit({ ...graph, nodes: [...graph.nodes, node] });
    selectNode(node.id);
    revealNode(node);
  }
  function addHandoff(sourceId: string, edgeId?: string) {
    if (graph.nodes.length >= NODE_LIMIT || graph.edges.length >= EDGE_LIMIT || locked) return;
    const source = graph.nodes.find((node) => node.id === sourceId);
    if (!source) return;
    const edge = graph.edges.find((item) => item.id === edgeId);
    const node: GraphNode = {
      id: crypto.randomUUID(),
      kind: 'handoff',
      label: 'Handoff',
      description: 'Summarize the result and pass it to the next owner.',
      recipientType: 'person',
      recipientName: '',
      branchMode: 'sequential',
      x: source.x + 310,
      y: source.y + 210,
    };
    commit(
      applyFactoryLayout({
        nodes: [...graph.nodes, node],
        edges: [
          ...graph.edges.filter((item) => item.id !== edgeId),
          {
            id: crypto.randomUUID(),
            source: source.id,
            target: node.id,
            order: edge?.order ?? outgoingForwardEdges(graph, source.id).length + 1,
          },
          ...(edge
            ? [{ id: crypto.randomUUID(), source: node.id, target: edge.target, order: 1 }]
            : []),
        ],
      }),
    );
    selectNode(node.id);
    if (!autoArrange) revealNode(node);
  }
  function undo() {
    if (locked || !past.length) return;
    setFuture((current) => [graph, ...current]);
    setGraph(past[past.length - 1]!);
    setPast(past.slice(0, -1));
    setSelectedId(null);
    setSelectedEdgeId(null);
    editGroup.current = null;
    setMessage('Change undone.');
    setError('');
  }
  function redo() {
    if (locked || !future.length) return;
    setPast((current) => [...current, graph]);
    setGraph(future[0]!);
    setFuture(future.slice(1));
    setSelectedId(null);
    setSelectedEdgeId(null);
    editGroup.current = null;
    setMessage('Change restored.');
    setError('');
  }
  function onNodesChange(changes: NodeChange<WorkflowCanvasNode>[]) {
    const positions = changes.filter((change) => change.type === 'position');
    if (locked || !positions.length) return;
    const next = {
      ...graph,
      nodes: graph.nodes.map((node) => {
        const change = positions.find((item) => item.id === node.id);
        return change?.type === 'position' && change.position
          ? { ...node, x: Math.round(change.position.x), y: Math.round(change.position.y) }
          : node;
      }),
    };
    if (dragOrigin.current) {
      setGraph(next);
      setMessage('');
    } else commit(next);
  }
  async function save() {
    if (locked || !dirty) return;
    const invalid = graph.nodes.find((node) => !node.label.trim());
    if (invalid) {
      selectNode(invalid.id);
      setError('Give every step a name before saving.');
      return;
    }
    if (graph.nodes.filter((node) => node.kind === 'trigger').length !== 1) {
      setError('A workflow needs exactly one business brief to start.');
      return;
    }
    setSaving(true);
    setError('');
    const next = {
      ...graph,
      nodes: graph.nodes.map((node) => ({
        ...node,
        label: node.label.trim(),
        description: node.description.trim(),
        ...(node.businessPrompt !== undefined
          ? { businessPrompt: node.businessPrompt.trim() }
          : {}),
        ...(node.responsibility
          ? {
              responsibility: Object.fromEntries(
                Object.entries(node.responsibility).map(([key, value]) => [key, value.trim()]),
              ) as NonNullable<GraphNode['responsibility']>,
            }
          : {}),
        ...(node.recipientName !== undefined ? { recipientName: node.recipientName.trim() } : {}),
      })),
    };
    try {
      const response = await fetch('/api/projects/' + project.id + '/graph', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ graph: next, expectedUpdatedAt: revision }),
      });
      const result: { title?: string; updatedAt?: string } = await response.json();
      if (!response.ok)
        throw new Error(
          result.title === 'Workflow changed in another tab'
            ? 'A newer draft was saved in another tab. Keep this tab open and resolve those changes before saving.'
            : result.title || 'Could not save. Your changes are still here; try again.',
        );
      setRevision(result.updatedAt ?? null);
      setGraph(next);
      setSaved(fingerprint(next));
      setMessage('Workflow draft saved.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the draft.');
    } finally {
      setSaving(false);
    }
  }

  const editor = (
    <section
      className={styles.factory + (expanded ? ' ' + styles.expanded : '')}
      aria-label={project.name + ' playground'}
      onKeyDown={(event) => {
        if ((event.target as HTMLElement).closest('input, textarea, select') || preview) return;
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
          event.preventDefault();
          if (event.shiftKey) redo();
          else undo();
        }
        if (event.key === 'Delete' && !locked) {
          event.preventDefault();
          if (selectedEdge) removeEdge(selectedEdge.id);
          else if (selected) removeNode();
        }
      }}
    >
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>{project.name} / Playground</p>
          <div className={styles.titleLine}>
            <h1>Visual Factory</h1>
            <span className={styles.draftStatus} data-dirty={dirty}>
              <span />
              {loading
                ? 'Loading…'
                : saving
                  ? 'Saving…'
                  : dirty
                    ? 'Unsaved changes'
                    : 'Draft saved'}
            </span>
          </div>
          <p>Build your team’s workflow. Connect people, agents, and decisions.</p>
        </div>
        <div className={styles.headingActions}>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => setPreview(true)}
            disabled={loading || !graph.nodes.length}
          >
            <GitBranchIcon size={17} />
            Review flow
          </button>
          <button
            className={styles.primaryButton}
            type="button"
            onClick={save}
            disabled={locked || !dirty}
          >
            <FloppyDiskIcon size={18} />
            {saving ? 'Saving…' : 'Save draft'}
          </button>
        </div>
      </header>
      {readOnly && (
        <div className={styles.notice}>
          <InfoIcon size={18} />
          {project.status !== 'active'
            ? 'This ' + project.status + ' project is read-only.'
            : 'You have view access. A project Owner or Admin can edit this workflow.'}
        </div>
      )}
      {error && (
        <div className={styles.error} role="alert">
          <WarningCircleIcon size={18} />
          <span>{error}</span>
          {loadFailed ? (
            <button type="button" onClick={() => setLoadAttempt((value) => value + 1)}>
              Try again
            </button>
          ) : (
            <button type="button" aria-label="Dismiss error" onClick={() => setError('')}>
              <XIcon size={17} />
            </button>
          )}
        </div>
      )}
      <div className={styles.editor}>
        <div className={styles.toolbar} aria-label="Workflow tools">
          <div className={styles.toolGroup}>
            <button
              type="button"
              onClick={undo}
              disabled={locked || !past.length}
              title="Undo (⌘/Ctrl Z)"
            >
              <ArrowCounterClockwiseIcon size={17} />
              <span>Undo</span>
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={locked || !future.length}
              title="Redo (⌘/Ctrl Shift Z)"
            >
              <ArrowClockwiseIcon size={17} />
              <span>Redo</span>
            </button>
          </div>
          <div className={styles.toolGroup}>
            <label className={styles.srOnly} htmlFor="workflow-layout">
              Layout direction
            </label>
            <select
              id="workflow-layout"
              value={direction}
              onChange={(event) => {
                const nextDirection = event.target.value as LayoutDirection;
                setDirection(nextDirection);
                if (!locked && graph.nodes.length) {
                  commit(arrangeGraph(graph, nextDirection));
                  requestAnimationFrame(() => requestAnimationFrame(fitAll));
                }
              }}
            >
              <option value="horizontal">Left to right</option>
              <option value="vertical">Top to bottom</option>
            </select>
            <button
              type="button"
              onClick={() => {
                commit(arrangeGraph(graph, direction));
                requestAnimationFrame(() => requestAnimationFrame(fitAll));
              }}
              disabled={locked || !graph.nodes.length}
            >
              <TreeStructureIcon size={17} />
              Arrange
            </button>
            <button
              type="button"
              aria-pressed={autoArrange}
              className={styles.autoLayoutButton}
              title="Reposition stages when a connection is added, edited, or removed"
              onClick={() => setAutoArrange((current) => !current)}
            >
              Auto-arrange {autoArrange ? 'on' : 'off'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              if (tourStep !== null) {
                setTourStep(null);
                return;
              }
              fitAll();
              setPanel('library');
              setTourStep(0);
            }}
            disabled={!graph.nodes.length || loading}
            aria-pressed={tourStep !== null}
            title="Visual walkthrough only; this does not run agents"
          >
            <PlayIcon size={17} />
            {tourStep === null ? 'Walk the line' : 'Stop preview'}
          </button>
          <button type="button" onClick={fitAll} disabled={!flow || !graph.nodes.length}>
            <FrameCornersIcon size={17} />
            Fit all
          </button>
          <div className={styles.toolbarEnd}>
            <button
              type="button"
              onClick={openLibrary}
              disabled={locked}
              className={styles.addStepButton}
            >
              <PlusIcon size={17} />
              Add step
            </button>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? 'Exit expanded editor' : 'Expand editor'}
              title={expanded ? 'Exit expanded editor (Esc)' : 'Expand editor'}
            >
              {expanded ? <ArrowsInIcon size={18} /> : <ArrowsOutIcon size={18} />}
            </button>
          </div>
        </div>
        <div className={styles.workbench}>
          <div className={styles.canvasColumn}>
            <div className={styles.canvasMeta}>
              <span>
                <span className={styles.statusDot} />
                Factory floor
              </span>
              <div
                className={styles.lineStatus}
                aria-label={`${readyCount} of ${checks.length} blueprint checks complete`}
              >
                <span>
                  {touringNode
                    ? `Walking: ${touringNode.label}`
                    : `${graph.nodes.length} stages · ${graph.edges.length} routes`}
                </span>
                <span className={styles.lineMeter} aria-hidden="true">
                  {checks.map((check) => (
                    <i key={check.label} data-ready={check.ready} />
                  ))}
                </span>
                <span>
                  {readyCount}/{checks.length} checks
                </span>
              </div>
            </div>
            <div
              ref={canvas}
              className={styles.canvas}
              onDragOver={(event) => {
                if (!locked) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'copy';
                }
              }}
              onDrop={onDrop}
            >
              {loading ? (
                <div className={styles.canvasEmpty}>
                  <span className={styles.spinner} />
                  <h2>Opening your workflow…</h2>
                </div>
              ) : loadFailed ? (
                <div className={styles.canvasEmpty}>
                  <WarningCircleIcon size={32} />
                  <h2>Workflow unavailable</h2>
                  <p>Try loading it again to continue.</p>
                </div>
              ) : (
                <ReactFlow<WorkflowCanvasNode, Edge>
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  onInit={setFlow}
                  onNodesChange={onNodesChange}
                  onNodeClick={(_, node) => selectNode(node.id)}
                  onEdgeClick={(_, edge) => selectEdge(edge.id)}
                  onPaneClick={() => {
                    setTourStep(null);
                    setSelectedId(null);
                    setSelectedEdgeId(null);
                  }}
                  onNodeDragStart={() => {
                    setTourStep(null);
                    dragOrigin.current = graph;
                    editGroup.current = null;
                  }}
                  onNodeDragStop={(_, node) => {
                    if (
                      dragOrigin.current &&
                      fingerprint(graph) !== fingerprint(dragOrigin.current)
                    ) {
                      const origin = dragOrigin.current;
                      setPast((current) => [...current.slice(-49), origin]);
                      setFuture([]);
                    }
                    dragOrigin.current = null;
                    selectNode(node.id, false);
                  }}
                  onConnect={(connection) => connect(connection)}
                  onConnectStart={(_, params) => {
                    setTourStep(null);
                    setConnectingSource(params.handleType === 'source' ? params.nodeId : null);
                    setError('');
                  }}
                  onConnectEnd={(_, state) => {
                    setConnectingSource(null);
                    if (!state.isValid && state.fromNode && state.toNode) {
                      const from =
                        state.fromHandle?.type === 'source' ? state.fromNode.id : state.toNode.id;
                      const to =
                        state.fromHandle?.type === 'source' ? state.toNode.id : state.fromNode.id;
                      const kind = state.toHandle?.id?.startsWith('feedback-in')
                        ? 'feedback'
                        : 'forward';
                      setError(connectionError(graph, from, to, undefined, kind) ?? '');
                    }
                  }}
                  onReconnectStart={(_, edge) => {
                    reconnecting.current = edge.id;
                  }}
                  onReconnect={(edge, connection) => connect(connection, edge.id)}
                  onReconnectEnd={() => {
                    reconnecting.current = null;
                    setConnectingSource(null);
                  }}
                  isValidConnection={(connection) =>
                    !connectionError(
                      graph,
                      connection.source,
                      connection.target,
                      reconnecting.current ?? undefined,
                      connection.targetHandle?.startsWith('feedback-in') ? 'feedback' : 'forward',
                    )
                  }
                  onMove={(_, view) => setZoom(view.zoom)}
                  nodesDraggable={!locked}
                  nodesConnectable={!locked}
                  edgesReconnectable={!locked}
                  deleteKeyCode={null}
                  multiSelectionKeyCode={null}
                  selectionKeyCode={null}
                  connectOnClick
                  connectionRadius={40}
                  reconnectRadius={16}
                  connectionLineType={ConnectionLineType.SmoothStep}
                  connectionLineStyle={{
                    stroke: '#2d7051',
                    strokeWidth: 2.5,
                    strokeDasharray: '6 4',
                  }}
                  nodeExtent={[
                    [-100000, -100000],
                    [100000, 100000],
                  ]}
                  snapToGrid
                  snapGrid={[16, 16]}
                  minZoom={0.15}
                  maxZoom={1.5}
                  fitView
                  fitViewOptions={{ padding: 0.18, maxZoom: 1 }}
                  panOnDrag
                  zoomOnDoubleClick={false}
                  attributionPosition="bottom-right"
                >
                  <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#cbd4c8" />
                </ReactFlow>
              )}
              {!loading && !loadFailed && !graph.nodes.length && (
                <div className={styles.canvasEmpty}>
                  <span className={styles.emptyIcon}>
                    <GitBranchIcon size={30} />
                  </span>
                  <h2>Start with your business brief.</h2>
                  <p>Define the business model before connecting your first agent.</p>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => {
                      const start = graph.nodes.find((node) => node.kind === 'trigger');
                      if (start) selectNode(start.id);
                    }}
                    disabled={locked}
                  >
                    <PlusIcon size={17} />
                    Define business brief
                  </button>
                </div>
              )}
              {connectingSource && (
                <div className={styles.connectionHint} role="status">
                  Drop on the green In point for a handoff, or the amber{' '}
                  {direction === 'vertical' ? 'side' : 'top'} point to return for review.
                </div>
              )}
              {touringNode && (
                <div className={styles.tourCaption} role="status">
                  <span>
                    Stage {tourStep! + 1} of {productionOrder.length}
                  </span>
                  <strong>{touringNode.label}</strong>
                  <small>Design preview · no agents are running</small>
                </div>
              )}
            </div>
            <div className={styles.canvasFooter}>
              <span className={styles.canvasHelp}>
                Drag Out → In to connect. Each numbered wire is a separate handoff; set branch order
                in Details. ∥ means parallel, and amber means return for review.
              </span>
              <div className={styles.zoomControls}>
                <button
                  type="button"
                  aria-label="Zoom out"
                  onClick={() => void flow?.zoomOut({ duration: duration() })}
                  disabled={!flow || zoom <= 0.15}
                >
                  <MinusIcon size={16} />
                </button>
                <span aria-label="Canvas zoom">{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  aria-label="Zoom in"
                  onClick={() => void flow?.zoomIn({ duration: duration() })}
                  disabled={!flow || zoom >= 1.5}
                >
                  <PlusIcon size={16} />
                </button>
              </div>
            </div>
          </div>
          <aside className={styles.sidePanel} aria-label="Workflow library and details">
            <div className={styles.panelTabs} role="tablist" aria-label="Editor panel">
              {(['library', 'details'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={panel === tab}
                  aria-controls={'workflow-' + tab}
                  id={'tab-' + tab}
                  tabIndex={panel === tab ? 0 : -1}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                      event.preventDefault();
                      const next = tab === 'library' ? 'details' : 'library';
                      setPanel(next);
                      (
                        event.currentTarget.parentElement?.querySelector(
                          '#tab-' + next,
                        ) as HTMLButtonElement | null
                      )?.focus();
                    }
                  }}
                  onClick={() => setPanel(tab)}
                >
                  {tab === 'library' ? 'Step library' : 'Details'}
                  {tab === 'details' && (selected || selectedEdge) && (
                    <span className={styles.tabDot} />
                  )}
                </button>
              ))}
            </div>
            {panel === 'library' ? (
              <div
                id="workflow-library"
                role="tabpanel"
                aria-labelledby="tab-library"
                className={styles.panelBody}
              >
                <h2>Build your team</h2>
                <p className={styles.panelIntro}>Drag a step onto the canvas, or select Add.</p>
                <button
                  type="button"
                  className={styles.businessStartShortcut}
                  disabled={loading || loadFailed}
                  onClick={() => {
                    const start = graph.nodes.find((node) => node.kind === 'trigger');
                    if (start) {
                      selectNode(start.id);
                      revealNode(start);
                    }
                  }}
                >
                  <span className={styles.libraryIcon}>
                    <InfoIcon size={21} />
                  </span>
                  <span>
                    <strong>Business brief</strong>
                    <small>Define the company context that starts every path.</small>
                  </span>
                  <ArrowRightIcon size={16} />
                </button>
                <label className={styles.librarySearch}>
                  <MagnifyingGlassIcon size={18} />
                  <span className={styles.srOnly}>Search steps</span>
                  <input
                    ref={search}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search agents and steps"
                  />
                </label>
                <div className={styles.categoryList} aria-label="Step categories">
                  {['All', 'Agents', 'Controls'].map((item) => (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={category === item}
                      onClick={() => setCategory(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <div className={styles.libraryList}>
                  {filtered.map((preset) => {
                    const Icon = roleIcons[preset.key];
                    return (
                      <div
                        key={preset.key}
                        className={styles.libraryCard}
                        draggable={!locked}
                        onDragStart={(event) => {
                          event.dataTransfer.setData('application/x-agentfactory-node', preset.key);
                          event.dataTransfer.effectAllowed = 'copy';
                        }}
                      >
                        <span className={styles.libraryIcon}>
                          <Icon size={21} />
                        </span>
                        <div>
                          <strong>{preset.name}</strong>
                          <p>{preset.description}</p>
                        </div>
                        <button
                          type="button"
                          disabled={locked || graph.nodes.length >= NODE_LIMIT}
                          onClick={() => addNode(preset.key)}
                          aria-label={'Add ' + preset.name}
                        >
                          <PlusIcon size={14} />
                          Add
                        </button>
                      </div>
                    );
                  })}
                  {!filtered.length && (
                    <div className={styles.panelEmpty}>
                      <p>No steps match “{query}”.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setQuery('');
                          setCategory('All');
                        }}
                      >
                        Clear search
                      </button>
                    </div>
                  )}
                </div>
                <div className={styles.libraryTip}>
                  <GitBranchIcon size={20} />
                  <p>
                    <strong>One agent, many connections.</strong> Branch work across a team or bring
                    several results together at a manager.
                  </p>
                </div>
              </div>
            ) : (
              <div
                id="workflow-details"
                role="tabpanel"
                aria-labelledby="tab-details"
                className={styles.panelBody}
              >
                {selected ? (
                  <>
                    <div className={styles.detailHeading}>
                      <span className={styles.eyebrow}>{kindLabels[selected.kind]}</span>
                      <button
                        type="button"
                        aria-label="Locate selected step"
                        title="Locate step on canvas"
                        onClick={() => revealNode(selected)}
                      >
                        <FrameCornersIcon size={18} />
                      </button>
                    </div>
                    <h2>{selected.kind === 'trigger' ? 'Business brief' : 'Step details'}</h2>
                    <p className={styles.panelIntro}>Changes are included when you save draft.</p>
                    {selected.kind === 'trigger' ? (
                      <div className={styles.businessPromptPanel}>
                        <h3>Business model prompt</h3>
                        <p>
                          Describe your company, customers, offer, goals, constraints, and the
                          outcome this workflow should produce. This context starts every agent
                          path; the start node has no model or other settings.
                        </p>
                        <label className={styles.field}>
                          Business brief
                          <textarea
                            value={selected.businessPrompt ?? ''}
                            maxLength={6000}
                            rows={12}
                            disabled={locked}
                            placeholder="We are a… Our customers are… We create value by… Our goals are… Decisions must respect… The desired outcome is…"
                            onChange={(event) =>
                              updateNode({ businessPrompt: event.target.value }, 'businessPrompt')
                            }
                            onBlur={() => {
                              editGroup.current = null;
                            }}
                          />
                          <small>{(selected.businessPrompt ?? '').length}/6000</small>
                        </label>
                        <p className={styles.promptHelp}>
                          Connect this card’s Out point to the first agent. Additional branches can
                          start here too. This is a saved design prompt, not a running AI request.
                        </p>
                      </div>
                    ) : (
                      <>
                        <label className={styles.field}>
                          Step name
                          <input
                            value={selected.label}
                            maxLength={100}
                            disabled={locked}
                            onChange={(event) => updateNode({ label: event.target.value }, 'label')}
                            onBlur={() => {
                              editGroup.current = null;
                            }}
                          />
                        </label>
                        <label className={styles.field}>
                          Step type
                          <select
                            value={selected.kind}
                            disabled={locked}
                            onChange={(event) =>
                              updateNode(
                                {
                                  kind: event.target.value as Kind,
                                  roleKey:
                                    event.target.value === 'agent' ? 'custom-agent' : undefined,
                                  responsibility:
                                    event.target.value === 'agent'
                                      ? (selected.responsibility ?? {
                                          roleMeaning: '',
                                          work: '',
                                          decisionProcess: '',
                                          decisionCriteria: '',
                                          handoff: '',
                                        })
                                      : undefined,
                                },
                                'kind',
                              )
                            }
                          >
                            {Object.entries(kindLabels)
                              .filter(([kind]) => kind !== 'trigger')
                              .map(([kind, label]) => (
                                <option key={kind} value={kind}>
                                  {label}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label className={styles.field}>
                          Card summary
                          <textarea
                            value={selected.description}
                            maxLength={500}
                            rows={4}
                            disabled={locked}
                            placeholder="A short description shown on the factory floor"
                            onChange={(event) =>
                              updateNode({ description: event.target.value }, 'description')
                            }
                            onBlur={() => {
                              editGroup.current = null;
                            }}
                          />
                          <small>{selected.description.length}/500</small>
                        </label>
                        {selected.kind === 'agent' && (
                          <section
                            className={styles.responsibilityPanel}
                            aria-label="Agent responsibility"
                          >
                            <div className={styles.responsibilityHeading}>
                              <h3>Responsibility</h3>
                              <p>
                                Tell this agent what it owns, how to decide, and what to pass on.
                              </p>
                            </div>
                            {(
                              [
                                [
                                  'roleMeaning',
                                  'Meaning of the role',
                                  'What is this role accountable for?',
                                ],
                                [
                                  'work',
                                  'Work to perform',
                                  'What tasks, inputs, and outputs belong to this role?',
                                ],
                                [
                                  'decisionProcess',
                                  'How to make decisions',
                                  'What steps should the agent follow before deciding?',
                                ],
                                [
                                  'decisionCriteria',
                                  'What makes the best decision',
                                  'What evidence, trade-offs, constraints, and success measures should it use?',
                                ],
                                [
                                  'handoff',
                                  'Response to the next step',
                                  'What should the agent send onward, in what format, and when?',
                                ],
                              ] as const
                            ).map(([key, label, placeholder]) => (
                              <label className={styles.field} key={key}>
                                {label}
                                <textarea
                                  value={selected.responsibility?.[key] ?? ''}
                                  maxLength={1200}
                                  rows={3}
                                  disabled={locked}
                                  placeholder={placeholder}
                                  onChange={(event) =>
                                    updateNode(
                                      {
                                        responsibility: {
                                          roleMeaning: selected.responsibility?.roleMeaning ?? '',
                                          work: selected.responsibility?.work ?? '',
                                          decisionProcess:
                                            selected.responsibility?.decisionProcess ?? '',
                                          decisionCriteria:
                                            selected.responsibility?.decisionCriteria ?? '',
                                          handoff: selected.responsibility?.handoff ?? '',
                                          [key]: event.target.value,
                                        },
                                      },
                                      'responsibility:' + key,
                                    )
                                  }
                                  onBlur={() => {
                                    editGroup.current = null;
                                  }}
                                />
                                <small>{(selected.responsibility?.[key] ?? '').length}/1200</small>
                              </label>
                            ))}
                          </section>
                        )}
                        <div className={styles.modelFields}>
                          <div className={styles.modelFieldsHeading}>
                            <RobotIcon size={19} aria-hidden="true" />
                            <div>
                              <strong>Agent intelligence</strong>
                              <p>Choose the model and effort for this stage.</p>
                            </div>
                          </div>
                          <label className={styles.field}>
                            Provider
                            <select
                              value={selected.modelConfig?.provider ?? ''}
                              disabled={locked}
                              onChange={(event) => {
                                const provider = event.target.value as ModelProvider | '';
                                const first = modelCatalog.find(
                                  (model) => model.provider === provider,
                                );
                                updateNode(
                                  {
                                    modelConfig: first
                                      ? {
                                          provider: first.provider,
                                          modelId: first.id,
                                          effort: 'medium',
                                        }
                                      : undefined,
                                  },
                                  'modelConfig',
                                );
                              }}
                            >
                              <option value="">Choose a provider</option>
                              {providers.map((provider) => (
                                <option key={provider.id} value={provider.id}>
                                  {provider.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className={styles.field}>
                            Model
                            <select
                              value={selected.modelConfig?.modelId ?? ''}
                              disabled={locked || !selected.modelConfig}
                              onChange={(event) => {
                                if (!selected.modelConfig) return;
                                updateNode(
                                  {
                                    modelConfig: {
                                      ...selected.modelConfig,
                                      modelId: event.target.value,
                                    },
                                  },
                                  'modelConfig',
                                );
                              }}
                            >
                              {!selected.modelConfig && (
                                <option value="">Select provider first</option>
                              )}
                              {modelCatalog
                                .filter(
                                  (model) => model.provider === selected.modelConfig?.provider,
                                )
                                .map((model) => (
                                  <option key={model.id} value={model.id}>
                                    {model.name}
                                  </option>
                                ))}
                              {selected.modelConfig &&
                                !modelCatalog.some(
                                  (model) => model.id === selected.modelConfig?.modelId,
                                ) && (
                                  <option value={selected.modelConfig.modelId}>
                                    {selected.modelConfig.modelId} (previously saved)
                                  </option>
                                )}
                            </select>
                          </label>
                          <fieldset
                            className={styles.effortField}
                            disabled={locked || !selected.modelConfig}
                          >
                            <legend>Effort level</legend>
                            <div className={styles.effortChoices}>
                              {(['low', 'medium', 'high'] as ModelEffort[]).map((effort) => (
                                <label
                                  key={effort}
                                  data-active={selected.modelConfig?.effort === effort}
                                >
                                  <input
                                    type="radio"
                                    name={'model-effort-' + selected.id}
                                    value={effort}
                                    checked={selected.modelConfig?.effort === effort}
                                    onChange={() => {
                                      if (!selected.modelConfig) return;
                                      updateNode(
                                        { modelConfig: { ...selected.modelConfig, effort } },
                                        'modelConfig',
                                      );
                                    }}
                                  />
                                  {effort}
                                </label>
                              ))}
                            </div>
                          </fieldset>
                          <p className={styles.modelNote}>
                            High suits infrequent, consequential decisions like a CEO review. This
                            is a draft setting; no model is called here.
                          </p>
                        </div>
                        {selected.kind === 'handoff' && (
                          <div className={styles.handoffFields}>
                            <label className={styles.field}>
                              Recipient type
                              <select
                                value={selected.recipientType ?? 'person'}
                                disabled={locked}
                                onChange={(event) =>
                                  updateNode(
                                    { recipientType: event.target.value as 'person' | 'agent' },
                                    'recipientType',
                                  )
                                }
                              >
                                <option value="person">Person</option>
                                <option value="agent">Agent</option>
                              </select>
                            </label>
                            <label className={styles.field}>
                              Recipient name or role
                              <input
                                value={selected.recipientName ?? ''}
                                maxLength={100}
                                placeholder="e.g. Manager or CEO"
                                disabled={locked}
                                onChange={(event) =>
                                  updateNode({ recipientName: event.target.value }, 'recipientName')
                                }
                                onBlur={() => {
                                  editGroup.current = null;
                                }}
                              />
                            </label>
                          </div>
                        )}
                        <div className={styles.detailSection}>
                          <h3>
                            Connections <span>{incoming.length + outgoing.length}</span>
                          </h3>
                          <p className={styles.panelIntro}>
                            Every agent can receive from and send to multiple steps.
                          </p>
                          {outgoingForwardEdges(graph, selected.id).length > 1 && (
                            <div className={styles.branchMode}>
                              <strong>When this step has multiple next steps</strong>
                              <div
                                className={styles.branchModeChoices}
                                role="group"
                                aria-label="Branch delivery mode"
                              >
                                <button
                                  type="button"
                                  aria-pressed={selected.branchMode !== 'parallel'}
                                  disabled={locked}
                                  onClick={() =>
                                    updateNode({ branchMode: 'sequential' }, 'branchMode')
                                  }
                                >
                                  In order
                                </button>
                                <button
                                  type="button"
                                  aria-pressed={selected.branchMode === 'parallel'}
                                  disabled={locked}
                                  onClick={() =>
                                    updateNode({ branchMode: 'parallel' }, 'branchMode')
                                  }
                                >
                                  In parallel
                                </button>
                              </div>
                              <p>
                                {selected.branchMode === 'parallel'
                                  ? 'Both routes are planned to begin together.'
                                  : 'Route 2 is planned to begin after route 1 completes. Use the arrows below to change the order.'}{' '}
                                This draft does not execute agents yet.
                              </p>
                            </div>
                          )}
                          {(['Incoming', 'Outgoing'] as const).map((label) => {
                            const list = label === 'Incoming' ? incoming : outgoing;
                            return (
                              <div className={styles.connectionList} key={label}>
                                <h4>
                                  {label} <span>{list.length}</span>
                                </h4>
                                {!list.length && <p>No {label.toLowerCase()} connections.</p>}
                                {list.map((edge) => {
                                  const other = graph.nodes.find(
                                    (node) =>
                                      node.id ===
                                      (label === 'Incoming' ? edge.source : edge.target),
                                  )!;
                                  const routeIndex =
                                    label === 'Outgoing' && edge.kind !== 'feedback'
                                      ? outgoingForwardEdges(graph, selected.id).findIndex(
                                          (item) => item.id === edge.id,
                                        )
                                      : -1;
                                  return (
                                    <div className={styles.connectionRow} key={edge.id}>
                                      {routeIndex >= 0 &&
                                        outgoingForwardEdges(graph, selected.id).length > 1 && (
                                          <span
                                            className={styles.routeOrderBadge}
                                            title={
                                              selected.branchMode === 'parallel'
                                                ? 'Parallel route'
                                                : `Route ${routeIndex + 1}`
                                            }
                                          >
                                            {selected.branchMode === 'parallel'
                                              ? '∥'
                                              : routeIndex + 1}
                                          </span>
                                        )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          selectNode(other.id);
                                          revealNode(other);
                                        }}
                                        title={'Open ' + other.label}
                                      >
                                        {edge.kind === 'feedback'
                                          ? '↩ Review: '
                                          : label === 'Incoming'
                                            ? '← '
                                            : '→ '}
                                        {other.label}
                                      </button>
                                      {routeIndex >= 0 &&
                                        outgoingForwardEdges(graph, selected.id).length > 1 &&
                                        selected.branchMode !== 'parallel' && (
                                          <span className={styles.orderControls}>
                                            <button
                                              type="button"
                                              aria-label={`Move route to ${other.label} earlier`}
                                              title="Move earlier"
                                              disabled={locked || routeIndex === 0}
                                              onClick={() =>
                                                commit(
                                                  moveOutgoingRoute(
                                                    graph,
                                                    selected.id,
                                                    edge.id,
                                                    -1,
                                                  ),
                                                )
                                              }
                                            >
                                              <ArrowUpIcon size={14} />
                                            </button>
                                            <button
                                              type="button"
                                              aria-label={`Move route to ${other.label} later`}
                                              title="Move later"
                                              disabled={
                                                locked ||
                                                routeIndex ===
                                                  outgoingForwardEdges(graph, selected.id).length -
                                                    1
                                              }
                                              onClick={() =>
                                                commit(
                                                  moveOutgoingRoute(graph, selected.id, edge.id, 1),
                                                )
                                              }
                                            >
                                              <ArrowDownIcon size={14} />
                                            </button>
                                          </span>
                                        )}
                                      <button
                                        type="button"
                                        aria-label={'Edit connection to ' + other.label}
                                        title="Edit connection"
                                        onClick={() => selectEdge(edge.id)}
                                      >
                                        <GitBranchIcon size={16} />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={locked}
                                        aria-label={'Remove connection with ' + other.label}
                                        title="Remove connection"
                                        onClick={() => removeEdge(edge.id)}
                                      >
                                        <XIcon size={15} />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                          <div className={styles.addConnection}>
                            <label className={styles.field}>
                              Connect to another step
                              <select
                                value={connectTarget}
                                disabled={locked}
                                onChange={(event) => setConnectTarget(event.target.value)}
                              >
                                <option value="">Choose a step…</option>
                                {graph.nodes
                                  .filter((node) => !connectionError(graph, selected.id, node.id))
                                  .map((node) => (
                                    <option key={node.id} value={node.id}>
                                      {node.label}
                                    </option>
                                  ))}
                              </select>
                            </label>
                            <button
                              type="button"
                              className={styles.secondaryButton}
                              disabled={locked || !connectTarget}
                              onClick={() =>
                                connect({ source: selected.id, target: connectTarget })
                              }
                            >
                              <PlusIcon size={16} />
                              Add connection
                            </button>
                            <label className={styles.field}>
                              Return for review
                              <select
                                value={feedbackTarget}
                                disabled={locked}
                                onChange={(event) => setFeedbackTarget(event.target.value)}
                              >
                                <option value="">Choose an earlier step…</option>
                                {graph.nodes
                                  .filter(
                                    (node) =>
                                      !connectionError(
                                        graph,
                                        selected.id,
                                        node.id,
                                        undefined,
                                        'feedback',
                                      ),
                                  )
                                  .map((node) => (
                                    <option key={node.id} value={node.id}>
                                      {node.label}
                                    </option>
                                  ))}
                              </select>
                            </label>
                            <button
                              type="button"
                              className={styles.secondaryButton}
                              disabled={locked || !feedbackTarget}
                              onClick={() =>
                                connect({
                                  source: selected.id,
                                  target: feedbackTarget,
                                  targetHandle: 'feedback-in',
                                })
                              }
                            >
                              <GitBranchIcon size={16} />
                              Add review loop
                            </button>
                            <p className={styles.panelIntro}>
                              For Romy → CEO, add a return path after CEO has handed work to Romy.
                              The amber route shows their review conversation.
                            </p>
                            <button
                              type="button"
                              className={styles.textButton}
                              disabled={
                                locked ||
                                graph.nodes.length >= NODE_LIMIT ||
                                graph.edges.length >= EDGE_LIMIT
                              }
                              onClick={() => addHandoff(selected.id)}
                            >
                              <GitBranchIcon size={16} />
                              Add a handoff branch
                            </button>
                          </div>
                        </div>
                        <div className={styles.detailActions}>
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            disabled={locked || graph.nodes.length >= NODE_LIMIT}
                            onClick={duplicateNode}
                          >
                            <CopyIcon size={16} />
                            Duplicate
                          </button>
                          <button
                            type="button"
                            className={styles.dangerButton}
                            disabled={locked}
                            onClick={removeNode}
                          >
                            <TrashIcon size={16} />
                            Delete step
                          </button>
                        </div>
                      </>
                    )}
                  </>
                ) : selectedEdge ? (
                  <>
                    <p className={styles.eyebrow}>Routing</p>
                    <h2>
                      {selectedEdge.kind === 'feedback'
                        ? 'Review conversation'
                        : 'Connection details'}
                    </h2>
                    <p className={styles.panelIntro}>
                      {selectedEdge.kind === 'feedback'
                        ? 'The agent presents its result to an earlier decision-maker. A requested revision returns along the production path, up to the round limit. This draft visualizes the route; it does not execute agents.'
                        : 'Change the source or destination here, or drag an endpoint on the canvas.'}
                    </p>
                    <label className={styles.field}>
                      From
                      <select
                        value={selectedEdge.source}
                        disabled={locked}
                        onChange={(event) =>
                          connect(
                            {
                              source: event.target.value,
                              target: selectedEdge.target,
                              targetHandle: selectedEdge.kind === 'feedback' ? 'feedback-in' : 'in',
                            },
                            selectedEdge.id,
                          )
                        }
                      >
                        {graph.nodes.map((node) => (
                          <option key={node.id} value={node.id}>
                            {node.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className={styles.routeArrow}>
                      <ArrowRightIcon size={20} />
                    </div>
                    <label className={styles.field}>
                      To
                      <select
                        value={selectedEdge.target}
                        disabled={locked}
                        onChange={(event) =>
                          connect(
                            {
                              source: selectedEdge.source,
                              target: event.target.value,
                              targetHandle: selectedEdge.kind === 'feedback' ? 'feedback-in' : 'in',
                            },
                            selectedEdge.id,
                          )
                        }
                      >
                        {graph.nodes
                          .filter((node) => node.kind !== 'trigger')
                          .map((node) => (
                            <option key={node.id} value={node.id}>
                              {node.label}
                            </option>
                          ))}
                      </select>
                    </label>
                    {selectedEdge.kind === 'feedback' && (
                      <div className={styles.detailSection}>
                        <label className={styles.field}>
                          What should be reviewed?
                          <input
                            value={selectedEdge.label ?? ''}
                            maxLength={120}
                            disabled={locked}
                            placeholder="Review the solution"
                            onChange={(event) =>
                              commit(
                                {
                                  ...graph,
                                  edges: graph.edges.map((edge) =>
                                    edge.id === selectedEdge.id
                                      ? { ...edge, label: event.target.value }
                                      : edge,
                                  ),
                                },
                                selectedEdge.id + ':label',
                              )
                            }
                            onBlur={() => {
                              editGroup.current = null;
                            }}
                          />
                        </label>
                        <label className={styles.field}>
                          Maximum review rounds
                          <select
                            value={selectedEdge.maxRounds ?? 2}
                            disabled={locked}
                            onChange={(event) =>
                              commit({
                                ...graph,
                                edges: graph.edges.map((edge) =>
                                  edge.id === selectedEdge.id
                                    ? { ...edge, maxRounds: Number(event.target.value) }
                                    : edge,
                                ),
                              })
                            }
                          >
                            {[1, 2, 3, 4, 5].map((rounds) => (
                              <option key={rounds} value={rounds}>
                                {rounds} {rounds === 1 ? 'round' : 'rounds'}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}
                    {selectedEdge.kind !== 'feedback' && (
                      <div className={styles.detailSection}>
                        <h3>Add an intermediate handoff</h3>
                        <p className={styles.panelIntro}>
                          Route information through a manager, CEO, or another agent before it
                          reaches the next step.
                        </p>
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          disabled={
                            locked ||
                            graph.nodes.length >= NODE_LIMIT ||
                            graph.edges.length >= EDGE_LIMIT
                          }
                          onClick={() => addHandoff(selectedEdge.source, selectedEdge.id)}
                        >
                          <PlusIcon size={16} />
                          Insert handoff
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      className={styles.dangerButton}
                      disabled={locked}
                      onClick={() => removeEdge(selectedEdge.id)}
                    >
                      <TrashIcon size={16} />
                      Remove connection
                    </button>
                  </>
                ) : (
                  <>
                    <div className={styles.panelEmpty}>
                      <span className={styles.emptyIcon}>
                        <InfoIcon size={26} />
                      </span>
                      <h2>Select a step or connection</h2>
                      <p>
                        Edit responsibilities, review incoming and outgoing paths, or choose a new
                        destination.
                      </p>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={openLibrary}
                      >
                        <PlusIcon size={16} />
                        Browse step library
                      </button>
                    </div>
                    <div className={styles.detailSection}>
                      <h3>Workflow checklist</h3>
                      <ul className={styles.checkList}>
                        {checks.map((check) => (
                          <li key={check.label} data-ready={check.ready}>
                            <CheckCircleIcon size={17} />
                            {check.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            )}
          </aside>
        </div>
        <div className={styles.statusBar}>
          <span role="status">
            {message ||
              (readOnly
                ? 'View only'
                : 'Draft mode · Review flow previews your design. Agents do not run yet.')}
          </span>
          <span>{readOnly ? project.role : 'Save draft to keep your changes'}</span>
        </div>
      </div>
      <dialog
        ref={reviewDialog}
        className={styles.reviewDialog}
        onCancel={() => setPreview(false)}
        onClose={() => setPreview(false)}
        aria-labelledby="workflow-review-title"
      >
        <div className={styles.reviewHeader}>
          <div>
            <p className={styles.eyebrow}>Workflow review</p>
            <h2 id="workflow-review-title">{project.name}</h2>
          </div>
          <button
            type="button"
            aria-label="Close workflow review"
            onClick={() => setPreview(false)}
          >
            <XIcon size={21} />
          </button>
        </div>
        <p className={styles.panelIntro}>
          Review the business brief, responsibilities, and routes in your draft. Branches split work
          across a team; incoming paths bring their results together. Amber review loops return a
          proposal to an earlier agent for a bounded conversation. Route numbers show the intended
          sequence; parallel routes are marked ∥. This is a blueprint, not a running workflow.
        </p>
        <div className={styles.reviewChecks}>
          {checks.map((check) => (
            <span key={check.label} data-ready={check.ready}>
              <CheckCircleIcon size={15} />
              {check.label}
            </span>
          ))}
        </div>
        <ol className={styles.reviewSteps}>
          {orderedNodes(graph).map((node) => (
            <li key={node.id}>
              <span className={styles.eyebrow}>{kindLabels[node.kind]}</span>
              <h3>{node.label || 'Untitled step'}</h3>
              {node.kind === 'trigger' ? (
                <p>
                  <strong>Business prompt:</strong>{' '}
                  {node.businessPrompt?.trim() || 'Not defined yet'}
                </p>
              ) : (
                <>
                  <p>{node.description}</p>
                  {node.kind === 'agent' && node.responsibility && (
                    <div className={styles.reviewResponsibility}>
                      <p>
                        <strong>Role:</strong> {node.responsibility.roleMeaning || 'Not defined'}
                      </p>
                      <p>
                        <strong>Work:</strong> {node.responsibility.work || 'Not defined'}
                      </p>
                      <p>
                        <strong>Decisions:</strong>{' '}
                        {node.responsibility.decisionProcess || 'Not defined'}
                      </p>
                      <p>
                        <strong>Best decision:</strong>{' '}
                        {node.responsibility.decisionCriteria || 'Not defined'}
                      </p>
                      <p>
                        <strong>Handoff:</strong> {node.responsibility.handoff || 'Not defined'}
                      </p>
                    </div>
                  )}
                  <p>
                    <strong>Model:</strong> {modelName(node.modelConfig)}
                    {node.modelConfig ? ` · ${node.modelConfig.effort} effort` : ''}
                  </p>
                </>
              )}
              {node.kind === 'handoff' && (
                <p>
                  <strong>Recipient:</strong> {node.recipientName || 'Not selected'} (
                  {node.recipientType ?? 'person'})
                </p>
              )}
              <div className={styles.reviewDestinations}>
                <span>Next:</span>
                {[
                  ...outgoingForwardEdges(graph, node.id),
                  ...graph.edges.filter(
                    (edge) => edge.source === node.id && edge.kind === 'feedback',
                  ),
                ].map((edge, index) => (
                  <span key={edge.id}>
                    {edge.kind === 'feedback' ? '↩ Review with ' : ''}
                    {edge.kind !== 'feedback' && outgoingForwardEdges(graph, node.id).length > 1
                      ? node.branchMode === 'parallel'
                        ? '∥ '
                        : `${index + 1}. `
                      : ''}
                    {graph.nodes.find((item) => item.id === edge.target)?.label}
                    {edge.kind === 'feedback' ? ` (max ${edge.maxRounds ?? 2} rounds)` : ''}
                  </span>
                ))}
                {!graph.edges.some((edge) => edge.source === node.id) && (
                  <span>{node.kind === 'output' ? 'Final output' : 'No next step connected'}</span>
                )}
              </div>
            </li>
          ))}
        </ol>
        <div className={styles.reviewFooter}>
          <span>
            {graph.nodes.length} steps · {graph.edges.length} connections
          </span>
          <button type="button" className={styles.primaryButton} onClick={() => setPreview(false)}>
            Back to editor
          </button>
        </div>
      </dialog>
    </section>
  );
  return expanded ? createPortal(editor, document.body) : editor;
}
