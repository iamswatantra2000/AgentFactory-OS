import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

export type ProjectRole = 'owner' | 'admin' | 'member';
export type ProjectStatus = 'preparing' | 'active' | 'paused' | 'archived';
export type ProjectMemberInput = { userId: string; role: Exclude<ProjectRole, 'owner'> };
export type CreateProject = {
  name: string;
  outcome: string;
  ownerId: string;
  teamName: string;
  startingPoint: 'blank' | 'template';
  templateKey?: string;
  members: ProjectMemberInput[];
};
export type WorkflowGraph = {
  nodes: Array<{
    id: string;
    kind: 'trigger' | 'agent' | 'handoff' | 'review' | 'output';
    roleKey?: string;
    recipientType?: 'person' | 'agent';
    recipientName?: string;
    modelConfig?: {
      provider: 'anthropic' | 'openai' | 'google';
      modelId: string;
      effort: 'low' | 'medium' | 'high';
    };
    branchMode?: 'sequential' | 'parallel';
    label: string;
    description: string;
    businessPrompt?: string;
    responsibility?: {
      roleMeaning: string;
      work: string;
      decisionProcess: string;
      decisionCriteria: string;
      handoff: string;
    };
    x: number;
    y: number;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    kind?: 'forward' | 'feedback';
    label?: string;
    maxRounds?: number;
    order?: number;
  }>;
};

type Row = {
  id: string;
  workspaceId: string;
  ownerId: string | null;
  name: string;
  outcome: string | null;
  teamName: string | null;
  startingPoint: 'blank' | 'template';
  templateKey: string | null;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
  lastOpenedAt: Date | null;
  role: ProjectRole;
  memberIds: string[];
};

export class ProjectLimitError extends Error {}
export class ProjectNotFoundError extends Error {}
export class ProjectForbiddenError extends Error {}
export class ProjectConflictError extends Error {}
export class ProjectRevisionConflictError extends Error {}

const columns = `p.id, p."workspaceId", p."ownerId", p.name, p.outcome,
  p."teamName", p."startingPoint", p."templateKey", p.status,
  p."createdAt", p."updatedAt", p."lastOpenedAt", m.role,
  ARRAY(SELECT pm."userId"::text FROM "ProjectMember" pm WHERE pm."projectId" = p.id) AS "memberIds"`;

export class ProjectRepository {
  constructor(
    private readonly pool: Pool,
    readonly projectLimit: number,
  ) {}

  async ready() {
    await this.pool.query('SELECT 1');
  }

  async list(workspaceId: string, userId: string) {
    const result = await this.pool.query<Row>(
      `SELECT ${columns} FROM "Project" p
       JOIN "ProjectMember" m ON m."projectId" = p.id AND m."userId" = $2
       WHERE p."workspaceId" = $1
       ORDER BY p."lastOpenedAt" DESC NULLS LAST, p."updatedAt" DESC`,
      [workspaceId, userId],
    );
    const count = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM "Project" WHERE "workspaceId" = $1 AND status <> 'archived'`,
      [workspaceId],
    );
    return {
      projects: result.rows,
      plan: {
        name: 'Development plan',
        projectLimit: this.projectLimit,
        projectCount: Number(count.rows[0]?.count ?? 0),
      },
    };
  }

  async get(workspaceId: string, userId: string, projectId: string) {
    const result = await this.pool.query<Row>(
      `SELECT ${columns} FROM "Project" p
       JOIN "ProjectMember" m ON m."projectId" = p.id AND m."userId" = $3
       WHERE p."workspaceId" = $1 AND p.id = $2`,
      [workspaceId, projectId, userId],
    );
    if (!result.rows[0]) throw new ProjectNotFoundError();
    return result.rows[0];
  }

  async create(workspaceId: string, userId: string, input: CreateProject) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [workspaceId]);
      const count = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM "Project" WHERE "workspaceId" = $1 AND status <> 'archived'`,
        [workspaceId],
      );
      if (Number(count.rows[0]?.count ?? 0) >= this.projectLimit) throw new ProjectLimitError();
      const id = randomUUID();
      const now = new Date();
      await client.query(
        `INSERT INTO "Project" (id, "workspaceId", "ownerId", name, description, outcome,
          "teamName", "startingPoint", "templateKey", status, "createdAt", "updatedAt", "lastOpenedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'preparing',$10,$10,$10)`,
        [
          id,
          workspaceId,
          input.ownerId,
          input.name,
          input.outcome,
          input.outcome,
          input.teamName,
          input.startingPoint,
          input.templateKey ?? null,
          now,
        ],
      );
      await client.query(
        `INSERT INTO "ProjectMember" ("projectId", "userId", role) VALUES ($1,$2,'owner')`,
        [id, input.ownerId],
      );
      if (input.ownerId !== userId) {
        await client.query(
          `INSERT INTO "ProjectMember" ("projectId", "userId", role) VALUES ($1,$2,'admin')`,
          [id, userId],
        );
      }
      for (const member of input.members) {
        if (member.userId === input.ownerId || member.userId === userId) continue;
        await client.query(
          `INSERT INTO "ProjectMember" ("projectId", "userId", role) VALUES ($1,$2,$3)`,
          [id, member.userId, member.role],
        );
      }
      await client.query('COMMIT');
      return this.get(workspaceId, userId, id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async open(workspaceId: string, userId: string, projectId: string) {
    const project = await this.get(workspaceId, userId, projectId);
    await this.pool.query('UPDATE "Project" SET "lastOpenedAt" = $1 WHERE id = $2', [
      new Date(),
      projectId,
    ]);
    return { ...project, lastOpenedAt: new Date() };
  }

  async completeSetup(workspaceId: string, userId: string, projectId: string) {
    const project = await this.get(workspaceId, userId, projectId);
    if (!['owner', 'admin'].includes(project.role)) throw new ProjectForbiddenError();
    if (project.status !== 'preparing') throw new ProjectConflictError();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO "ProjectDocument" ("projectId", "schemaVersion", "graphJson", "updatedAt")
         VALUES ($1,1,$2,$3) ON CONFLICT ("projectId") DO NOTHING`,
        [
          projectId,
          JSON.stringify({ nodes: [], edges: [], templateKey: project.templateKey }),
          new Date(),
        ],
      );
      await client.query(
        `UPDATE "Project" SET status = 'active', "updatedAt" = $1 WHERE id = $2 AND "workspaceId" = $3`,
        [new Date(), projectId, workspaceId],
      );
      await client.query('COMMIT');
      return this.get(workspaceId, userId, projectId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getGraph(workspaceId: string, userId: string, projectId: string) {
    await this.get(workspaceId, userId, projectId);
    const result = await this.pool.query<{ graphJson: WorkflowGraph; updatedAt: Date }>(
      `SELECT "graphJson", "updatedAt" FROM "ProjectDocument" WHERE "projectId" = $1`,
      [projectId],
    );
    const document = result.rows[0];
    return {
      graph: document?.graphJson ?? { nodes: [], edges: [] },
      updatedAt: document?.updatedAt.toISOString() ?? null,
    };
  }

  async saveGraph(
    workspaceId: string,
    userId: string,
    projectId: string,
    graph: WorkflowGraph,
    expectedUpdatedAt: string | null,
  ) {
    const project = await this.get(workspaceId, userId, projectId);
    if (!['owner', 'admin'].includes(project.role)) throw new ProjectForbiddenError();
    if (project.status !== 'active') throw new ProjectConflictError();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [projectId]);
      const current = await client.query<{ updatedAt: Date }>(
        `SELECT "updatedAt" FROM "ProjectDocument" WHERE "projectId" = $1 FOR UPDATE`,
        [projectId],
      );
      const existing = current.rows[0]?.updatedAt.toISOString() ?? null;
      if (existing !== expectedUpdatedAt) throw new ProjectRevisionConflictError();
      const now = new Date();
      if (current.rows[0]) {
        await client.query(
          `UPDATE "ProjectDocument" SET "graphJson" = $1, "updatedAt" = $2 WHERE "projectId" = $3`,
          [JSON.stringify(graph), now, projectId],
        );
      } else {
        await client.query(
          `INSERT INTO "ProjectDocument" ("projectId", "schemaVersion", "graphJson", "updatedAt") VALUES ($1,1,$2,$3)`,
          [projectId, JSON.stringify(graph), now],
        );
      }
      await client.query('COMMIT');
      return { graph, updatedAt: now.toISOString() };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async changeStatus(
    workspaceId: string,
    userId: string,
    projectId: string,
    status: 'active' | 'paused' | 'archived',
  ) {
    const project = await this.get(workspaceId, userId, projectId);
    if (!['owner', 'admin'].includes(project.role)) throw new ProjectForbiddenError();
    if (project.status === 'preparing') throw new ProjectConflictError();
    if (status === 'active' && !['paused', 'archived'].includes(project.status))
      throw new ProjectConflictError();
    if (status === 'paused' && project.status !== 'active') throw new ProjectConflictError();
    if (status === 'archived' && project.status === 'archived') throw new ProjectConflictError();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [workspaceId]);
      if (project.status === 'archived' && status === 'active') {
        const count = await client.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM "Project" WHERE "workspaceId" = $1 AND status <> 'archived'`,
          [workspaceId],
        );
        if (Number(count.rows[0]?.count ?? 0) >= this.projectLimit) throw new ProjectLimitError();
      }
      const result = await client.query(
        `UPDATE "Project" SET status = $1, "updatedAt" = $2
         WHERE id = $3 AND "workspaceId" = $4 AND status = $5`,
        [status, new Date(), projectId, workspaceId, project.status],
      );
      if (result.rowCount !== 1) throw new ProjectConflictError();
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return this.get(workspaceId, userId, projectId);
  }
}
