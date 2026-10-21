import { forwardProjectRequest } from '@/server/project-bff';

export function GET(request: Request) {
  return forwardProjectRequest(request, '/api/v1/workspace/members');
}
