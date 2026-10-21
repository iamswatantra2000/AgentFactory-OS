import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import localFont from 'next/font/local';
import '../components/design-system/tokens.css';
import '../components/design-system/components.css';
import '../components/design-system/patterns.css';

const display = localFont({
  src: './fonts/playfair-display-latin.woff2',
  weight: '400 900',
  display: 'swap',
  variable: '--font-playfair-display',
});
const interfaceFont = localFont({
  src: './fonts/montserrat-latin.woff2',
  weight: '100 900',
  display: 'swap',
  variable: '--font-montserrat',
});
const workspaceDisplay = localFont({
  src: './fonts/inter-tight-latin.woff2',
  weight: '400 700',
  display: 'swap',
  preload: false,
  variable: '--font-inter-tight',
});

export const metadata: Metadata = {
  title: {
    default: 'AgentFactory OS',
    template: '%s | AgentFactory OS',
  },
  description: 'Design the first version of your AI-enabled company.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${interfaceFont.variable} ${workspaceDisplay.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
