import { forwardProjectRequest } from '@/server/project-bff';

type Context = { params: Promise<{ projectId: string }> };

function path(projectId: string) {
  return /^[0-9a-f-]{36}$/i.test(projectId) ? `/api/v1/projects/${projectId}/graph` : null;
}

export async function GET(request: Request, { params }: Context) {
  const target = path((await params).projectId);
  return target
    ? forwardProjectRequest(request, target)
    : Response.json({ title: 'Invalid project ID' }, { status: 400 });
}

export async function POST(request: Request, { params }: Context) {
  const target = path((await params).projectId);
  return target
    ? forwardProjectRequest(request, target)
    : Response.json({ title: 'Invalid project ID' }, { status: 400 });
}
