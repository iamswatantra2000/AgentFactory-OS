import { forwardProjectRequest } from '@/server/project-bff';

export function GET(request: Request) {
  return forwardProjectRequest(request, '/api/v1/projects');
}
export function POST(request: Request) {
  return forwardProjectRequest(request, '/api/v1/projects');
}
