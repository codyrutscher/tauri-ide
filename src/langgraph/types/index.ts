import { z } from 'zod';

// State schema for the graph
export const AgentStateSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system', 'tool']),
    content: z.string(),
    tool_calls: z.array(z.object({
      id: z.string(),
      name: z.string(),
      args: z.record(z.any()),
    })).optional(),
    tool_call_id: z.string().optional(),
  })),
  currentFile: z.string().optional(),
  projectPath: z.string().optional(),
  context: z.record(z.any()).optional(),
  nextAction: z.string().optional(),
});

export type AgentState = z.infer<typeof AgentStateSchema>;

// Tool definitions
export interface Tool {
  name: string;
  description: string;
  parameters: z.ZodSchema<any>;
  execute: (args: any) => Promise<string>;
}

// Workflow node types
export type WorkflowNode = {
  id: string;
  name: string;
  type: 'llm' | 'tool' | 'conditional' | 'human';
  config?: any;
};

export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  condition?: string;
};

export interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  entryPoint: string;
}

// Agent types
export interface Agent {
  id: string;
  name: string;
  description: string;
  tools: string[];
  systemPrompt: string;
  temperature?: number;
  model?: string;
}

// Graph execution result
export interface GraphExecutionResult {
  success: boolean;
  output: any;
  steps: ExecutionStep[];
  error?: string;
}

export interface ExecutionStep {
  nodeId: string;
  nodeName: string;
  input: any;
  output: any;
  duration: number;
  timestamp: Date;
}