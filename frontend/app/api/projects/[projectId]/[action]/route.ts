import { forwardProjectRequest } from '@/server/project-bff';

const actions = new Set(['open', 'complete-setup', 'state']);
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; action: string }> },
) {
  const { projectId, action } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(projectId) || !actions.has(action))
    return Response.json({ title: 'Unknown project action' }, { status: 404 });
  return forwardProjectRequest(request, `/api/v1/projects/${projectId}/${action}`);
}
