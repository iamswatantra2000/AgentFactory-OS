import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { DM_Serif_Display, Inter } from 'next/font/google';
import '../components/design-system/tokens.css';
import '../components/design-system/components.css';
import '../components/design-system/patterns.css';

const display = DM_Serif_Display({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-dm-serif-display',
});
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: {
    default: 'AgentFactory OS',
    template: '%s | AgentFactory OS',
  },
  description: 'Design the first version of your AI-enabled company.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
