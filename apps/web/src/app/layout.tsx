import './globals.css';
import type { Metadata } from 'next';
import { ThemeProvider } from '../components/ThemeProvider';
import { ThresholdProvider } from '../context/ThresholdContext';
import { ProjectProvider } from '../context/ProjectContext';
import { AiChatProvider } from '../context/AiChatContext';
import { AICopilotDrawer } from '../components/ai/AICopilotDrawer';

export const metadata: Metadata = {
  title: 'EasyMetrics | Zero-Config Open-Source APM',
  description: 'Production observability and AI debugging for modern Node.js developers.',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-zinc-100/80 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 min-h-screen transition-colors duration-200 antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ThresholdProvider>
            <ProjectProvider>
              <AiChatProvider>
                {children}
                <AICopilotDrawer />
              </AiChatProvider>
            </ProjectProvider>
          </ThresholdProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

