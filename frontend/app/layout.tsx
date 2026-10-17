import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Playfair_Display, Montserrat } from 'next/font/google';
import '../components/design-system/tokens.css';
import '../components/design-system/components.css';
import '../components/design-system/patterns.css';

const display = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair-display',
});
const interfaceFont = Montserrat({ subsets: ['latin'], variable: '--font-montserrat' });

export const metadata: Metadata = {
  title: {
    default: 'AgentFactory OS',
    template: '%s | AgentFactory OS',
  },
  description: 'Design the first version of your AI-enabled company.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${interfaceFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
