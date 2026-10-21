const gateway = process.env.API_GATEWAY_URL ?? 'http://localhost:4000';
export type ProjectRole = 'owner' | 'admin' | 'member';
export type Project = {
  id: string;
  workspaceId: string;
  ownerId: string | null;
  name: string;
  outcome: string | null;
  teamName: string | null;
  startingPoint: 'blank' | 'template';
  templateKey: string | null;
  status: 'preparing' | 'active' | 'paused' | 'archived';
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
  role: ProjectRole;
  memberIds: string[];
};
export type WorkspaceMember = { id: string; email: string; name: string | null; role: ProjectRole };
export type ProjectList = {
  projects: Project[];
  plan: { name: string; projectLimit: number; projectCount: number };
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function maybeString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}
function isProject(value: unknown): value is Project {
  if (!record(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.workspaceId === 'string' &&
    maybeString(value.ownerId) &&
    typeof value.name === 'string' &&
    maybeString(value.outcome) &&
    maybeString(value.teamName) &&
    (value.startingPoint === 'blank' || value.startingPoint === 'template') &&
    maybeString(value.templateKey) &&
    ['preparing', 'active', 'paused', 'archived'].includes(String(value.status)) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    maybeString(value.lastOpenedAt) &&
    ['owner', 'admin', 'member'].includes(String(value.role)) &&
    Array.isArray(value.memberIds) &&
    value.memberIds.every((id) => typeof id === 'string')
  );
}
function isMember(value: unknown): value is WorkspaceMember {
  return (
    record(value) &&
    typeof value.id === 'string' &&
    typeof value.email === 'string' &&
    maybeString(value.name) &&
    ['owner', 'admin', 'member'].includes(String(value.role))
  );
}
function isList(value: unknown): value is ProjectList {
  return (
    record(value) &&
    Array.isArray(value.projects) &&
    value.projects.every(isProject) &&
    record(value.plan) &&
    typeof value.plan.name === 'string' &&
    typeof value.plan.projectLimit === 'number' &&
    typeof value.plan.projectCount === 'number'
  );
}
async function read(path: string, cookieHeader: string) {
  return fetch(`${gateway}${path}`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
    signal: AbortSignal.timeout(5_000),
  });
}
export async function getProjects(cookieHeader: string): Promise<ProjectList | null> {
  try {
    const response = await read('/api/v1/projects', cookieHeader);
    if (!response.ok) return null;
    const result: unknown = await response.json();
    return isList(result) ? result : null;
  } catch {
    return null;
  }
}
export async function getProject(cookieHeader: string, id: string): Promise<Project | null> {
  try {
    const response = await read(`/api/v1/projects/${id}`, cookieHeader);
    if (!response.ok) return null;
    const result: unknown = await response.json();
    return isProject(result) ? result : null;
  } catch {
    return null;
  }
}
export async function getWorkspaceMembers(cookieHeader: string): Promise<WorkspaceMember[]> {
  try {
    const response = await read('/api/v1/workspace/members', cookieHeader);
    if (!response.ok) return [];
    const result: unknown = await response.json();
    return record(result) && Array.isArray(result.members) && result.members.every(isMember)
      ? result.members
      : [];
  } catch {
    return [];
  }
}
