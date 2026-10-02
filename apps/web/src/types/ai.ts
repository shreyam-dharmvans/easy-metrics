export interface ToolExecution {
  id: string;
  name: string;
  args?: Record<string, any>;
  result?: any;
  status: 'running' | 'completed' | 'failed';
  startedAt?: number;
  completedAt?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  status: 'streaming' | 'done' | 'error';
  toolCalls: ToolExecution[];
  traceId?: string;
  timestamp: number;
}

export type AiStreamEvent =
  | { type: 'token'; content: string }
  | { type: 'tool_start'; tool: string; args: Record<string, any> }
  | { type: 'tool_end'; tool: string; result?: any }
  | { type: 'done' }
  | { type: 'error'; message: string };

