import { timingSafeEqual } from 'node:crypto';
import express, { type Request, type Response } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { z } from 'zod';
import { createLogger } from '@agentfactory/observability';
import {
  ProjectConflictError,
  ProjectForbiddenError,
  ProjectLimitError,
  ProjectNotFoundError,
  ProjectRevisionConflictError,
  type ProjectRepository,
} from './repository.js';

const uuid = z.uuid();
const graphSchema = z
  .object({
    nodes: z
      .array(
        z.object({
          id: uuid,
          kind: z.enum(['trigger', 'agent', 'handoff', 'review', 'output']),
          roleKey: z.string().trim().min(1).max(80).optional(),
          recipientType: z.enum(['person', 'agent']).optional(),
          recipientName: z.string().trim().max(100).optional(),
          modelConfig: z
            .object({
              provider: z.enum(['anthropic', 'openai', 'google']),
              modelId: z.string().trim().min(1).max(100),
              effort: z.enum(['low', 'medium', 'high']),
            })
            .optional(),
          branchMode: z.enum(['sequential', 'parallel']).optional(),
          label: z.string().trim().min(1).max(100),
          description: z.string().trim().max(500),
          businessPrompt: z.string().trim().max(6000).optional(),
          responsibility: z
            .object({
              roleMeaning: z.string().trim().max(1200),
              work: z.string().trim().max(1200),
              decisionProcess: z.string().trim().max(1200),
              decisionCriteria: z.string().trim().max(1200),
              handoff: z.string().trim().max(1200),
            })
            .optional(),
          x: z.number().finite().min(-100000).max(100000),
          y: z.number().finite().min(-100000).max(100000),
        }),
      )
      .max(80),
    edges: z
      .array(
        z.object({
          id: uuid,
          source: uuid,
          target: uuid,
          kind: z.enum(['forward', 'feedback']).optional(),
          label: z.string().trim().max(120).optional(),
          maxRounds: z.number().int().min(1).max(5).optional(),
          order: z.number().int().min(1).max(160).optional(),
        }),
      )
      .max(160),
  })
  .superRefine((graph, context) => {
    const ids = new Set(graph.nodes.map((node) => node.id));
    if (ids.size !== graph.nodes.length)
      context.addIssue({ code: 'custom', path: ['nodes'], message: 'Duplicate node ID' });
    const starts = graph.nodes.filter((node) => node.kind === 'trigger');
    // Older saved drafts used trigger as a regular role, sometimes with review loops.
    // The businessPrompt field identifies the new dedicated start-node contract.
    const dedicatedStart = starts.some((node) => node.businessPrompt !== undefined);
    if (dedicatedStart && starts.length !== 1)
      context.addIssue({
        code: 'custom',
        path: ['nodes'],
        message: 'A workflow needs one business start',
      });
    for (const [index, node] of graph.nodes.entries()) {
      if (node.businessPrompt !== undefined && node.kind !== 'trigger')
        context.addIssue({
          code: 'custom',
          path: ['nodes', index, 'businessPrompt'],
          message: 'Only the business start can hold the business prompt',
        });
      if (node.responsibility !== undefined && node.kind !== 'agent')
        context.addIssue({
          code: 'custom',
          path: ['nodes', index, 'responsibility'],
          message: 'Responsibilities belong to agents',
        });
      if (
        dedicatedStart &&
        node.kind === 'trigger' &&
        (node.modelConfig || node.description || node.responsibility)
      )
        context.addIssue({
          code: 'custom',
          path: ['nodes', index],
          message: 'The business start only holds the business prompt',
        });
    }
    const pairs = new Set<string>();
    for (const [index, edge] of graph.edges.entries()) {
      const pair = `${edge.source}:${edge.target}`;
      if (
        !ids.has(edge.source) ||
        !ids.has(edge.target) ||
        edge.source === edge.target ||
        pairs.has(pair) ||
        (dedicatedStart &&
          graph.nodes.some((node) => node.id === edge.target && node.kind === 'trigger')) ||
        (edge.kind !== 'feedback' && edge.maxRounds !== undefined)
      )
        context.addIssue({ code: 'custom', path: ['edges', index], message: 'Invalid connection' });
      pairs.add(pair);
    }
    const indegree = new Map(graph.nodes.map((node) => [node.id, 0]));
    const children = new Map(graph.nodes.map((node) => [node.id, [] as string[]]));
    for (const edge of graph.edges.filter((item) => item.kind !== 'feedback')) {
      if (!ids.has(edge.source) || !ids.has(edge.target)) continue;
      children.get(edge.source)!.push(edge.target);
      indegree.set(edge.target, indegree.get(edge.target)! + 1);
    }
    const queue = [...indegree].filter(([, count]) => count === 0).map(([id]) => id);
    for (let index = 0; index < queue.length; index++) {
      for (const target of children.get(queue[index]!) ?? []) {
        const count = indegree.get(target)! - 1;
        indegree.set(target, count);
        if (count === 0) queue.push(target);
      }
    }
    if (queue.length !== ids.size)
      context.addIssue({
        code: 'custom',
        path: ['edges'],
        message: 'Workflow connections cannot form a loop',
      });
    for (const [index, edge] of graph.edges.entries()) {
      if (edge.kind !== 'feedback') continue;
      const visited = new Set<string>();
      const pending = [edge.target];
      while (pending.length) {
        const current = pending.pop()!;
        if (visited.has(current)) continue;
        visited.add(current);
        pending.push(...(children.get(current) ?? []));
      }
      if (!visited.has(edge.source))
        context.addIssue({
          code: 'custom',
          path: ['edges', index],
          message: 'Feedback must return to an upstream step',
        });
    }
  });
const createSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    outcome: z.string().trim().min(10).max(1000),
    ownerId: uuid,
    teamName: z.string().trim().min(1).max(120),
    startingPoint: z.enum(['blank', 'template']),
    templateKey: z.enum(['customer-insights', 'campaign-operations']).optional(),
    members: z
      .array(z.object({ userId: uuid, role: z.enum(['admin', 'member']) }))
      .max(50)
      .default([]),
  })
  .superRefine((data, context) => {
    if (data.startingPoint === 'template' && !data.templateKey) {
      context.addIssue({ code: 'custom', path: ['templateKey'], message: 'Select a template' });
    }
    if (new Set(data.members.map((member) => member.userId)).size !== data.members.length) {
      context.addIssue({ code: 'custom', path: ['members'], message: 'Duplicate member' });
    }
  });

function problem(response: Response, status: number, title: string) {
  return response
    .status(status)
    .type('application/problem+json')
    .json({ type: 'about:blank', title, status });
}

function sameSecret(provided: string, expected: string) {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function context(request: Request) {
  const userId = uuid.safeParse(request.header('x-af-user-id'));
  const workspaceId = uuid.safeParse(request.header('x-af-workspace-id'));
  return userId.success && workspaceId.success
    ? { userId: userId.data, workspaceId: workspaceId.data }
    : null;
}

function id(request: Request) {
  return uuid.safeParse(request.params.projectId).data;
}

export function createApp(repository: ProjectRepository, internalToken: string) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use('/v1/projects/:projectId/graph', express.json({ limit: '768kb' }));
  app.use(express.json({ limit: '32kb' }));
  app.use(
    pinoHttp({
      logger: createLogger('project-service'),
      serializers: {
        req: (request) => ({ id: request.id, method: request.method, url: request.url }),
      },
    }),
  );
  app.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.get('/health/live', (_request, response) =>
    response.json({ name: 'project-service', status: 'ok', timestamp: new Date().toISOString() }),
  );
  app.get('/health/ready', async (_request, response) => {
    try {
      await repository.ready();
      response.json({ name: 'project-service', status: 'ok', timestamp: new Date().toISOString() });
    } catch {
      problem(response, 503, 'Project database unavailable');
    }
  });
  app.use('/v1/projects', (request, response, next) => {
    if (!sameSecret(request.header('x-af-internal-token') ?? '', internalToken))
      return problem(response, 403, 'Service access denied');
    if (!context(request)) return problem(response, 401, 'Project context required');
    next();
  });

  app.get('/v1/projects', async (request, response) => {
    const actor = context(request)!;
    response.json(await repository.list(actor.workspaceId, actor.userId));
  });
  app.post('/v1/projects', async (request, response) => {
    const input = createSchema.safeParse(request.body);
    if (!input.success) return problem(response, 400, 'Check the project details and try again');
    const actor = context(request)!;
    const project = await repository.create(actor.workspaceId, actor.userId, input.data);
    return response.status(201).json(project);
  });
  app.get('/v1/projects/:projectId', async (request, response) => {
    if (!id(request)) return problem(response, 400, 'Invalid project ID');
    const actor = context(request)!;
    response.json(await repository.get(actor.workspaceId, actor.userId, id(request)!));
  });
  app.post('/v1/projects/:projectId/open', async (request, response) => {
    if (!id(request)) return problem(response, 400, 'Invalid project ID');
    const actor = context(request)!;
    response.json(await repository.open(actor.workspaceId, actor.userId, id(request)!));
  });
  app.post('/v1/projects/:projectId/complete-setup', async (request, response) => {
    if (!id(request)) return problem(response, 400, 'Invalid project ID');
    const actor = context(request)!;
    response.json(await repository.completeSetup(actor.workspaceId, actor.userId, id(request)!));
  });
  app.post('/v1/projects/:projectId/state', async (request, response) => {
    if (!id(request)) return problem(response, 400, 'Invalid project ID');
    const state = z
      .object({ status: z.enum(['active', 'paused', 'archived']) })
      .safeParse(request.body);
    if (!state.success) return problem(response, 400, 'Invalid project state');
    const actor = context(request)!;
    response.json(
      await repository.changeStatus(
        actor.workspaceId,
        actor.userId,
        id(request)!,
        state.data.status,
      ),
    );
  });
  app.get('/v1/projects/:projectId/graph', async (request, response) => {
    if (!id(request)) return problem(response, 400, 'Invalid project ID');
    const actor = context(request)!;
    response.json(await repository.getGraph(actor.workspaceId, actor.userId, id(request)!));
  });
  app.post('/v1/projects/:projectId/graph', async (request, response) => {
    if (!id(request)) return problem(response, 400, 'Invalid project ID');
    const input = z
      .object({
        graph: graphSchema,
        expectedUpdatedAt: z.iso.datetime().nullable(),
      })
      .safeParse(request.body);
    if (!input.success) return problem(response, 400, 'Check the workflow and try again');
    const actor = context(request)!;
    response.json(
      await repository.saveGraph(
        actor.workspaceId,
        actor.userId,
        id(request)!,
        input.data.graph,
        input.data.expectedUpdatedAt,
      ),
    );
  });
  app.use((error: unknown, request: Request, response: Response, _next: express.NextFunction) => {
    if (error instanceof ProjectLimitError)
      return problem(response, 409, `Project limit reached: ${repository.projectLimit}`);
    if (error instanceof ProjectNotFoundError) return problem(response, 404, 'Project not found');
    if (error instanceof ProjectForbiddenError)
      return problem(response, 403, 'Project role does not permit this action');
    if (error instanceof ProjectConflictError)
      return problem(response, 409, 'Project is not in the required state');
    if (error instanceof ProjectRevisionConflictError)
      return problem(response, 409, 'Workflow changed in another tab');
    request.log.error({ err: error }, 'Project request failed');
    return problem(response, 500, 'Project service error');
  });
  return app;
}
