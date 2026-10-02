'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAiChat } from '../../context/AiChatContext';
import { useProject } from '../../context/ProjectContext';
import { AiMarkdownRenderer } from './AiMarkdownRenderer';
import { ToolExecutionBadge } from './ToolExecutionBadge';
import { ToolExecution } from '../../types/ai';

const SUGGESTED_PROMPTS = [
  {
    icon: '🔥',
    title: 'Slowest Routes',
    prompt: 'What are the top 5 slowest routes in my application and their latency percentiles?',
  },
  {
    icon: '⚡',
    title: 'Primary Bottlenecks',
    prompt: 'Analyze primary latency bottlenecks where child spans consume >= 40% of request time.',
  },
  {
    icon: '🚨',
    title: 'Recent 500 Errors',
    prompt: 'What application errors occurred recently? Show stack traces and suggest code fixes.',
  },
  {
    icon: '📊',
    title: 'Route Health Overview',
    prompt: 'Give me a complete health breakdown of throughput (RPM), P50/P95, and error rates.',
  },
];

export function AICopilotDrawer() {
  const { isDemo } = useProject();
  const {
    isOpen,
    closeDrawer,
    messages,
    isStreaming,
    activeTraceContext,
    clearActiveTraceContext,
    removeTraceContext,
    removeRouteContext,
    sendMessage,
    stopStreaming,
    clearChat,
  } = useAiChat();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom whenever messages update or stream tokens arrive
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isStreaming, isOpen]);

  // Focus textarea when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isDemo) {
      alert('AI Copilot messaging is disabled in read-only Demo Mode. Please sign in with Google to run AI diagnostics.');
      return;
    }
    if (!input.trim() || isStreaming) return;
    sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <>
      {/* 1. Backdrop Overlay */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-xs z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        onClick={closeDrawer}
        aria-hidden="true"
      />

      {/* 2. Slide-out Drawer Panel */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[540px] md:w-[600px] lg:w-[640px] bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col h-full overflow-hidden transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
      >
        {/* Drawer Header */}
        <header className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white text-base shadow-xs shrink-0">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-zinc-950 dark:text-white">
                  EasyMetrics AI SRE Copilot
                </h2>
                {isDemo ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                    Demo Mode
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                Groq • openai/gpt-oss-120b (128k context)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={clearChat}
              className="px-2.5 py-1 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-xs font-semibold cursor-pointer"
              title="Clear conversation"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={closeDrawer}
              className="w-7 h-7 rounded-lg border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer text-xs"
              title="Close drawer (Esc)"
            >
              ✕
            </button>
          </div>
        </header>

        {/* Active Context Banner */}
        {activeTraceContext && (activeTraceContext.traceId || activeTraceContext.route || activeTraceContext.timeframe || activeTraceContext.thresholds) && (
          <div className="px-4 py-2 bg-indigo-50/90 dark:bg-indigo-950/50 border-b border-indigo-200/80 dark:border-indigo-800/60 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              <span className="font-bold text-[10px] uppercase tracking-wider text-indigo-600 dark:text-indigo-400 shrink-0">
                Context:
              </span>
              {activeTraceContext.route && (
                <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-indigo-100/90 dark:bg-indigo-900/70 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 font-semibold shadow-2xs">
                  <span>Route: {activeTraceContext.route}</span>
                  <button
                    type="button"
                    onClick={removeRouteContext}
                    className="text-indigo-500 hover:text-indigo-800 dark:hover:text-indigo-100 text-xs ml-0.5 cursor-pointer font-bold leading-none"
                    title="Remove route context"
                  >
                    ✕
                  </button>
                </span>
              )}
              {activeTraceContext.traceId && (
                <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-white dark:bg-zinc-900 px-2 py-0.5 rounded border border-indigo-300 dark:border-indigo-700/80 text-indigo-700 dark:text-indigo-300 font-semibold shadow-2xs">
                  <span>Trace: {activeTraceContext.traceId.slice(0, 10)}...</span>
                  <button
                    type="button"
                    onClick={removeTraceContext}
                    className="text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-200 text-xs ml-0.5 cursor-pointer font-bold leading-none"
                    title="Remove trace context"
                  >
                    ✕
                  </button>
                </span>
              )}
              {activeTraceContext.timeframe && (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 shadow-2xs font-semibold">
                  <span>Time: {activeTraceContext.timeframe}</span>
                </span>
              )}
              {activeTraceContext.thresholds && (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 shadow-2xs">
                  <span>Slow &gt;{activeTraceContext.thresholds.slowMs}ms | Bottleneck ≥{activeTraceContext.thresholds.bottleneckPercent}%</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={clearActiveTraceContext}
                className="text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-semibold cursor-pointer px-1.5 py-0.5 rounded hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition-colors"
                title="Clear all active context"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Chat Messages Body (with min-h-0 so flexbox scroll works perfectly) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 min-h-0">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';

            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shrink-0 text-xs font-bold shadow-xs mt-0.5">
                    ⚡
                  </div>
                )}

                <div
                  className={`max-w-[90%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-xs break-words ${isUser
                    ? 'bg-indigo-600 text-white rounded-tr-xs font-medium'
                    : 'bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-tl-xs'
                    }`}
                >
                  {/* Tool execution badges */}
                  {!isUser && msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="mb-2.5 pb-2 border-b border-zinc-200/80 dark:border-zinc-800/80 space-y-1">
                      <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                        Agent Actions &amp; Tool Calls
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.toolCalls.map((tool: ToolExecution) => (
                          <ToolExecutionBadge key={tool.id} tool={tool} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Message content */}
                  {isUser ? (
                    <p className="whitespace-pre-wrap font-sans text-xs leading-relaxed">{msg.content}</p>
                  ) : msg.content ? (
                    <AiMarkdownRenderer content={msg.content} />
                  ) : msg.status === 'streaming' ? (
                    <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 py-1">
                      <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                      <span className="italic text-xs font-medium">Analyzing telemetry &amp; formulating diagnosis...</span>
                    </div>
                  ) : null}
                </div>

                {isUser && (
                  <div className="w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
                    👤
                  </div>
                )}
              </div>
            );
          })}

          {/* Quick Diagnostic Suggestion Chips (Shown on fresh chat) */}
          {messages.length <= 1 && (
            <div className="pt-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                Suggested Diagnostics
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUGGESTED_PROMPTS.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => {
                      if (isDemo) {
                        alert('AI Copilot messaging is disabled in read-only Demo Mode. Please sign in with Google to run AI diagnostics.');
                        return;
                      }
                      sendMessage(item.prompt);
                    }}
                    className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-950/40 dark:hover:bg-zinc-800/60 text-left transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      <span>{item.icon}</span>
                      <span>{item.title}</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                      {item.prompt}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar & Controls (Unified rounded card container that never clips) */}
        <footer className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
          {isDemo ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-center space-y-2 shadow-2xs">
              <div className="text-xs font-bold text-amber-800 dark:text-amber-200 flex items-center justify-center gap-1.5">
                <span>🔒</span>
                <span>AI Copilot messaging is disabled in Demo Mode</span>
              </div>
              <p className="text-[11px] text-amber-700/90 dark:text-amber-300/80 max-w-md mx-auto leading-relaxed">
                Sign in with Google to connect your backend services and run AI SRE diagnostics on your live traces.
              </p>
              <div className="pt-1">
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v1/auth/google`}
                  className="inline-block px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-2xs transition-colors"
                >
                  Sign In with Google
                </a>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 p-2 shadow-2xs focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500 transition-all">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  activeTraceContext?.traceId
                    ? `Ask about trace ${activeTraceContext.traceId.slice(0, 8)}... (Enter to send)`
                    : activeTraceContext?.route
                      ? `Ask about route ${activeTraceContext.route}... (Enter to send)`
                      : 'Ask about slow routes, latency bottlenecks, or errors... (Enter to send)'
                }
                rows={2}
                className="w-full resize-none bg-transparent px-2 py-1 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden leading-relaxed font-sans block max-h-32"
              />
              <div className="flex items-center justify-between pt-1.5 border-t border-zinc-200/60 dark:border-zinc-800/60 mt-1">
                <span className="text-[10px] text-zinc-400 font-mono pl-1">
                  ↵ Enter to send • Shift+Enter for newline
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isStreaming ? (
                    <button
                      type="button"
                      onClick={stopStreaming}
                      className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                      <span>Stop</span>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!input.trim()}
                      className="px-3.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                    >
                      <span>Send</span>
                      <span className="text-[10px]">↵</span>
                    </button>
                  )}
                </div>
              </div>
            </form>
          )}
        </footer>
      </aside>
    </>
  );
}

