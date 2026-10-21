import { forwardProjectRequest } from '@/server/project-bff';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(projectId))
    return Response.json({ title: 'Invalid project ID' }, { status: 400 });
  return forwardProjectRequest(request, `/api/v1/projects/${projectId}`);
}
