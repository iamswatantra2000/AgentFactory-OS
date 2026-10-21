import type { ReactNode } from 'react';

export default function DashboardFlowLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <div data-dashboard-flow>{children}</div>;
}
