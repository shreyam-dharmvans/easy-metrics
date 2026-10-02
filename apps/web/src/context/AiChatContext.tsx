'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage, ToolExecution, AiStreamEvent } from '../types/ai';

export interface ActiveTraceContext {
  traceId?: string;
  route?: string;
  durationMs?: number;
  hasError?: boolean;
  timeframe?: string;
  thresholds?: {
    fastMs: number;
    slowMs: number;
    bottleneckPercent: number;
  };
}

interface AiChatContextType {
  // Drawer visibility
  isOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;

  // Chat conversation
  messages: ChatMessage[];
  isStreaming: boolean;
  activeTraceContext: ActiveTraceContext | null;
  setActiveTraceContext: (ctx: ActiveTraceContext | null) => void;
  clearActiveTraceContext: () => void;
  removeTraceContext: () => void;
  removeRouteContext: () => void;

  // Session & User
  threadId: string;
  userId: string;
  setUserId: (id: string) => void;

  // Actions
  sendMessage: (prompt: string, context?: { traceId?: string; route?: string }) => Promise<void>;
  stopStreaming: () => void;
  clearChat: () => void;
  diagnoseTrace: (traceId: string, traceMeta?: { route?: string; durationMs?: number; hasError?: boolean }) => void;
  diagnoseRoute: (route: string) => void;
}

const AiChatContext = createContext<AiChatContextType | undefined>(undefined);

const INITIAL_GREETING: ChatMessage = {
  id: 'greeting',
  role: 'assistant',
  content: `👋 **Hi, I'm your AI SRE Copilot.**

I have direct access to your live EasyMetrics APM telemetry, trace execution flamegraphs, and database health.

Ask me anything or try one of these quick diagnostics:
- **"What are the slowest routes in my app right now?"**
- **"Diagnose recent 500 server crashes and show stack traces"**
- **"How can I optimize slow database queries?"**`,
  status: 'done',
  toolCalls: [],
  timestamp: Date.now(),
};

const SESSION_ACTIVE_KEY = 'easymetrics_session_alive';
const AGENT_BASE_URL = process.env.NEXT_PUBLIC_AGENT_URL || 'http://localhost:8000';

function getInitialUserId(): string {
  if (typeof window === 'undefined') return 'cmu7z3qjx0000m3ccex2925ts';
  let uid = localStorage.getItem('easymetrics_user_id');
  if (!uid) {
    uid = 'cmu7z3qjx0000m3ccex2925ts';
    try {
      localStorage.setItem('easymetrics_user_id', uid);
    } catch { }
  }
  return uid;
}

export function AiChatProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [userId, setUserId] = useState<string>(getInitialUserId);
  const threadId = `user_${userId}`;
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_GREETING]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTraceContext, setActiveTraceContext] = useState<ActiveTraceContext | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const autoDetectContext = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const pathname = window.location.pathname;
      const search = window.location.search;
      const params = new URLSearchParams(search);
      const routeParam = params.get('route');
      const timeframeParam = params.get('timeframe');

      // Check if on /dashboard/traces/[traceId]
      const traceMatch = pathname.match(/\/dashboard\/traces\/([a-zA-Z0-9_-]+)/);
      const pathTraceId = traceMatch ? traceMatch[1] : undefined;

      let thresholds = { fastMs: 150, slowMs: 500, bottleneckPercent: 40 };
      try {
        const stored = localStorage.getItem('easymetrics_thresholds');
        if (stored) thresholds = { ...thresholds, ...JSON.parse(stored) };
      } catch { }

      let activeTimeframe = '7d';
      try {
        const storedTimeframe = localStorage.getItem('easymetrics_timeframe');
        if (storedTimeframe) activeTimeframe = storedTimeframe;
      } catch { }

      const detectedTimeframe = timeframeParam || activeTimeframe;

      setActiveTraceContext((prev) => ({
        ...prev,
        traceId: pathTraceId || prev?.traceId,
        route: routeParam || (pathTraceId ? undefined : prev?.route),
        timeframe: detectedTimeframe,
        thresholds,
      }));
    } catch {
      // Ignore
    }
  }, []);

  const openDrawer = useCallback(() => {
    autoDetectContext();
    setIsOpen(true);
  }, [autoDetectContext]);

  const closeDrawer = useCallback(() => setIsOpen(false), []);

  const toggleDrawer = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) autoDetectContext();
      return !prev;
    });
  }, [autoDetectContext]);

  const clearActiveTraceContext = useCallback(() => setActiveTraceContext(null), []);

  const removeTraceContext = useCallback(() => {
    setActiveTraceContext((prev) => (prev?.route ? { route: prev.route } : null));
  }, []);

  const removeRouteContext = useCallback(() => {
    setActiveTraceContext((prev) =>
      prev?.traceId
        ? { traceId: prev.traceId, durationMs: prev.durationMs, hasError: prev.hasError }
        : null
    );
  }, []);

  // Global ⌘K / Ctrl+K and Escape keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle drawer with ⌘K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      // Close with Escape if open
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setMessages((prev) =>
      prev.map((msg) =>
        msg.status === 'streaming' ? { ...msg, status: 'done' } : msg
      )
    );
  }, []);

  // Session lifecycle & persistence:
  // - If user refreshed (F5): sessionStorage marker is alive -> fetch conversation history from PostgreSQL checkpoints
  // - If user opened tab/site anew (sessionStorage is empty): wipe stale Postgres checkpoints & start clean
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isSessionAlive = sessionStorage.getItem(SESSION_ACTIVE_KEY);
    const currentThreadId = `user_${getInitialUserId()}`;

    if (!isSessionAlive) {
      // 1. Mark this tab session as active
      sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');

      // 2. Clear leftover Postgres checkpoints for this user thread from past sessions
      fetch(`${AGENT_BASE_URL}/api/chat/threads/${encodeURIComponent(currentThreadId)}`, {
        method: 'DELETE',
      }).catch((err) => console.warn('Could not reset thread on session start:', err));

      // 3. Reset state to greeting
      setMessages([INITIAL_GREETING]);
    } else {
      // Session was already active: this is a page refresh!
      // Retrieve conversational history directly from PostgreSQL checkpointer
      fetch(`${AGENT_BASE_URL}/api/chat/threads/${encodeURIComponent(currentThreadId)}`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (data && Array.isArray(data.messages) && data.messages.length > 0) {
            setMessages([INITIAL_GREETING, ...data.messages]);
          }
        })
        .catch((e) => {
          console.warn('Failed to load chat history from PostgreSQL:', e);
        });
    }
  }, []);

  const clearChat = useCallback(async () => {
    stopStreaming();
    setMessages([INITIAL_GREETING]);
    setActiveTraceContext(null);

    // Purge PostgreSQL checkpoints for this user thread
    try {
      await fetch(`${AGENT_BASE_URL}/api/chat/threads/${encodeURIComponent(threadId)}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.warn('Failed to clear PostgreSQL thread history:', err);
    }
  }, [stopStreaming, threadId]);

  const sendMessage = useCallback(
    async (prompt: string, context?: { traceId?: string; route?: string }) => {
      const isDemo =
        typeof window !== 'undefined' &&
        (sessionStorage.getItem('easymetrics_is_demo') === 'true' ||
          localStorage.getItem('easymetrics_is_demo') === 'true' ||
          new URLSearchParams(window.location.search).get('demo') === 'true' ||
          document.cookie.includes('easymetrics_is_demo=true'));

      if (isDemo) {
        alert('AI Copilot messaging is disabled in Demo Mode. Please sign in with Google to run AI diagnostics.');
        return;
      }

      const trimmedPrompt = prompt.trim();
      if (!trimmedPrompt || isStreaming) return;

      // Stop any existing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Open drawer automatically when a message is sent
      setIsOpen(true);

      const userMsgId = `user_${Date.now()}`;
      const assistantMsgId = `asst_${Date.now()}`;

      const userMessage: ChatMessage = {
        id: userMsgId,
        role: 'user',
        content: trimmedPrompt,
        status: 'done',
        toolCalls: [],
        traceId: context?.traceId || activeTraceContext?.traceId,
        timestamp: Date.now(),
      };

      const assistantMessage: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        status: 'streaming',
        toolCalls: [],
        traceId: context?.traceId || activeTraceContext?.traceId,
        timestamp: Date.now(),
      };

      // Append messages to state
      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsStreaming(true);

      try {
        // Construct prompt payload including traceId, route, and thresholds if relevant
        let fullMessage = trimmedPrompt;
        let contextPrefix = '';
        const targetTraceId = context?.traceId || activeTraceContext?.traceId;
        const targetRoute = context?.route || activeTraceContext?.route;
        const thresholds = activeTraceContext?.thresholds;

        if (targetTraceId && !trimmedPrompt.includes(targetTraceId)) {
          contextPrefix += `[Context: Active Trace ID is ${targetTraceId}]\n`;
        }
        if (targetRoute && !trimmedPrompt.includes(targetRoute)) {
          contextPrefix += `[Context: Active Route is ${targetRoute}]\n`;
        }
        if (activeTraceContext?.timeframe) {
          contextPrefix += `[Context: Active Timeframe Filter is ${activeTraceContext.timeframe}]\n`;
        }
        if (thresholds) {
          contextPrefix += `[Context: Active Latency Thresholds: Slow >= ${thresholds.slowMs}ms, Fast <= ${thresholds.fastMs}ms, Bottleneck >= ${thresholds.bottleneckPercent}%]\n`;
        }
        if (contextPrefix) {
          fullMessage = `${contextPrefix}\n${trimmedPrompt}`;
        }

        // Directly connect to FastAPI AI Agent SSE stream on port 8000
        const activeProjectId = typeof window !== 'undefined' ? localStorage.getItem('em_project_id') || '' : '';
        const agentEndpoint = `${AGENT_BASE_URL}/api/chat/stream`;

        const response = await fetch(agentEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(activeProjectId ? { 'x-project-id': activeProjectId } : {}),
            ...(isDemo ? { 'x-easymetrics-demo': 'true' } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({
            message: fullMessage,
            thread_id: threadId,
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`AI Agent service returned status ${response.status}: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Hold trailing line in buffer

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;

            const jsonStr = trimmed.replace(/^data:\s*/, '');
            if (!jsonStr) continue;

            try {
              const event: AiStreamEvent = JSON.parse(jsonStr);

              if (event.type === 'token') {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, content: msg.content + event.content }
                      : msg
                  )
                );
              } else if (event.type === 'tool_start') {
                const newTool: ToolExecution = {
                  id: `tool_${Date.now()}_${Math.random()}`,
                  name: event.tool,
                  args: event.args,
                  status: 'running',
                  startedAt: Date.now(),
                };
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, toolCalls: [...msg.toolCalls, newTool] }
                      : msg
                  )
                );
              } else if (event.type === 'tool_end') {
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id !== assistantMsgId) return msg;
                    const updatedTools = msg.toolCalls.map((t: ToolExecution) =>
                      t.name === event.tool && t.status === 'running'
                        ? { ...t, status: 'completed' as const, completedAt: Date.now() }
                        : t
                    );
                    return { ...msg, toolCalls: updatedTools };
                  })
                );
              } else if (event.type === 'done') {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, status: 'done' as const }
                      : msg
                  )
                );
              } else if (event.type === 'error') {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? {
                        ...msg,
                        content: msg.content + `\n\n> ⚠️ **Error:** ${event.message}`,
                        status: 'error' as const,
                      }
                      : msg
                  )
                );
              }
            } catch {
              // Ignore partial JSON parse errors
            }
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          // User aborted the stream intentionally
          return;
        }
        console.error('Error during AI chat stream:', err);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                ...msg,
                content:
                  msg.content ||
                  `⚠️ **Connection Error:** Could not reach the AI SRE agent service (${err.message}). Please ensure the service is running on port 8000.`,
                status: 'error',
              }
              : msg
          )
        );
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [isStreaming, activeTraceContext]
  );

  const diagnoseTrace = useCallback(
    (traceId: string, traceMeta?: { route?: string; durationMs?: number; hasError?: boolean }) => {
      setActiveTraceContext({
        traceId,
        route: traceMeta?.route,
        durationMs: traceMeta?.durationMs,
        hasError: traceMeta?.hasError,
      });

      const prompt = `Diagnose trace \`${traceId}\`${traceMeta?.route ? ` on route \`${traceMeta.route}\`` : ''}.
Reconstruct its execution waterfall, identify any latency bottlenecks (child spans taking >= 40% of duration), and recommend concrete code fixes.`;

      sendMessage(prompt, { traceId, route: traceMeta?.route });
    },
    [sendMessage]
  );

  const diagnoseRoute = useCallback(
    (route: string) => {
      setActiveTraceContext({ route });
      const prompt = `Analyze route health and performance for \`${route}\`. Show throughput (RPM), P50/P95 latency percentiles, error rate, and identify the slowest traces.`;
      sendMessage(prompt, { route });
    },
    [sendMessage]
  );

  return (
    <AiChatContext.Provider
      value={{
        isOpen,
        openDrawer,
        closeDrawer,
        toggleDrawer,
        messages,
        isStreaming,
        activeTraceContext,
        setActiveTraceContext,
        clearActiveTraceContext,
        removeTraceContext,
        removeRouteContext,
        threadId,
        userId,
        setUserId,
        sendMessage,
        stopStreaming,
        clearChat,
        diagnoseTrace,
        diagnoseRoute,
      }}
    >
      {children}
    </AiChatContext.Provider>
  );
}

export function useAiChat() {
  const ctx = useContext(AiChatContext);
  if (!ctx) {
    throw new Error('useAiChat must be used within an AiChatProvider');
  }
  return ctx;
}

