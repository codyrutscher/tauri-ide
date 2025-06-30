import { AgentState, Workflow, GraphExecutionResult, ExecutionStep, WorkflowNode } from '../types';
import { getToolsByNames } from '../agents/tools';

interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
}

export class BrowserWorkflowEngine {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async executeWorkflow(
    workflow: Workflow,
    initialState: Partial<AgentState>
  ): Promise<GraphExecutionResult> {
    const steps: ExecutionStep[] = [];
    const startTime = Date.now();

    try {
      // Initialize state
      let state: AgentState = {
        messages: initialState.messages || [],
        currentFile: initialState.currentFile,
        projectPath: initialState.projectPath,
        context: initialState.context || {},
        nextAction: initialState.nextAction,
      };

      // Execute workflow nodes in sequence
      const nodeMap = new Map(workflow.nodes.map(n => [n.id, n]));
      const visited = new Set<string>();
      
      // Start from entry point
      let currentNodeId = workflow.entryPoint;
      
      while (currentNodeId && currentNodeId !== 'END') {
        if (visited.has(currentNodeId)) {
          throw new Error(`Circular reference detected at node: ${currentNodeId}`);
        }
        visited.add(currentNodeId);

        const node = nodeMap.get(currentNodeId);
        if (!node) {
          throw new Error(`Node not found: ${currentNodeId}`);
        }

        const stepStart = Date.now();
        const input = { ...state };
        
        // Execute node based on type
        state = await this.executeNode(node, state);
        
        const step: ExecutionStep = {
          nodeId: node.id,
          nodeName: node.name,
          input,
          output: state,
          duration: Date.now() - stepStart,
          timestamp: new Date(),
        };
        steps.push(step);

        // Find next node
        const edge = workflow.edges.find(e => e.source === currentNodeId);
        currentNodeId = edge?.target || 'END';
      }

      return {
        success: true,
        output: state,
        steps,
      };
    } catch (error) {
      return {
        success: false,
        output: null,
        steps,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async executeNode(node: WorkflowNode, state: AgentState): Promise<AgentState> {
    switch (node.type) {
      case 'llm':
        return await this.executeLLMNode(node, state);
      
      case 'tool':
        return await this.executeToolNode(node, state);
      
      case 'conditional':
        return this.executeConditionalNode(node, state);
      
      case 'human':
        // For now, just pass through - in real app would wait for input
        return state;
      
      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }

  private async executeLLMNode(node: WorkflowNode, state: AgentState): Promise<AgentState> {
    try {
      const systemPrompt = node.config?.systemPrompt || 'You are a helpful assistant.';
      
      // Convert messages to Anthropic format
      const anthropicMessages = state.messages.map(msg => ({
        role: msg.role === 'system' ? 'assistant' : msg.role,
        content: msg.content,
      }));

      // Call Claude API
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: node.config?.model || 'claude-3-5-sonnet-20241022',
          messages: anthropicMessages,
          system: systemPrompt,
          temperature: node.config?.temperature || 0.7,
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(`Claude API error: ${response.statusText} ${errorData?.error?.message || ''}`);
      }

      const data = await response.json();
      
      return {
        ...state,
        messages: [...state.messages, {
          role: 'assistant',
          content: data.content[0].text,
        }],
      };
    } catch (error) {
      throw new Error(`LLM node error: ${error}`);
    }
  }

  private async executeToolNode(node: WorkflowNode, state: AgentState): Promise<AgentState> {
    const toolName = node.config?.toolName;
    if (!toolName) {
      throw new Error('Tool node missing toolName in config');
    }

    const tools = getToolsByNames([toolName]);
    if (tools.length === 0) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    const tool = tools[0];
    const args = node.config?.args || {};
    
    // Add context from state
    if (state.currentFile && args.path === undefined) {
      args.path = `${state.projectPath}/${state.currentFile}`;
    }

    try {
      const result = await tool.execute(args);
      
      return {
        ...state,
        messages: [...state.messages, {
          role: 'tool',
          content: result,
        }],
        context: {
          ...state.context,
          lastToolResult: result,
        },
      };
    } catch (error) {
      throw new Error(`Tool execution error: ${error}`);
    }
  }

  private executeConditionalNode(node: WorkflowNode, state: AgentState): AgentState {
    // Simple conditional logic based on state
    const condition = node.config?.condition;
    
    if (!condition) {
      return state;
    }

    // Evaluate condition (simplified)
    let nextAction = 'default';
    
    if (condition === 'has_error') {
      nextAction = state.context?.lastToolResult?.includes('Error') ? 'error' : 'success';
    } else if (condition === 'has_file') {
      nextAction = state.currentFile ? 'with_file' : 'no_file';
    }

    return {
      ...state,
      nextAction,
    };
  }
}

// Create pre-built workflows
export function createSimpleCodeAssistantWorkflow(): Workflow {
  return {
    id: 'simple-code-assistant',
    name: 'Simple Code Assistant',
    description: 'A simple workflow for code assistance without complex graph features',
    nodes: [
      {
        id: 'understand',
        name: 'Understand Request',
        type: 'llm',
        config: {
          systemPrompt: 'You are a helpful code assistant. Analyze the user request and provide helpful guidance.',
          model: 'claude-3-5-sonnet-20241022',
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'understand', target: 'END' },
    ],
    entryPoint: 'understand',
  };
}

export function createFileAnalysisWorkflow(): Workflow {
  return {
    id: 'file-analysis',
    name: 'File Analysis',
    description: 'Analyze the current file and provide insights',
    nodes: [
      {
        id: 'read',
        name: 'Read File',
        type: 'tool',
        config: {
          toolName: 'read_file',
        },
      },
      {
        id: 'analyze',
        name: 'Analyze Content',
        type: 'llm',
        config: {
          systemPrompt: 'Analyze the file content and provide insights about code structure, potential improvements, and best practices.',
          model: 'claude-3-5-sonnet-20241022',
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'read', target: 'analyze' },
      { id: 'e2', source: 'analyze', target: 'END' },
    ],
    entryPoint: 'read',
  };
}

export function createRefactoringWorkflow(): Workflow {
  return {
    id: 'refactoring-assistant',
    name: 'Refactoring Assistant',
    description: 'Help refactor code with best practices',
    nodes: [
      {
        id: 'understand',
        name: 'Understand Code',
        type: 'llm',
        config: {
          systemPrompt: 'Analyze the user\'s refactoring request and plan the approach.',
          model: 'claude-3-5-sonnet-20241022',
        },
      },
      {
        id: 'suggest',
        name: 'Suggest Refactoring',
        type: 'llm',
        config: {
          systemPrompt: 'Based on the analysis, provide specific refactoring suggestions with code examples.',
          model: 'claude-3-5-sonnet-20241022',
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'understand', target: 'suggest' },
      { id: 'e2', source: 'suggest', target: 'END' },
    ],
    entryPoint: 'understand',
  };
}

export function createDocumentationWorkflow(): Workflow {
  return {
    id: 'documentation-generator',
    name: 'Documentation Generator',
    description: 'Generate documentation for code',
    nodes: [
      {
        id: 'analyze_code',
        name: 'Analyze Code Structure',
        type: 'tool',
        config: {
          toolName: 'analyze_code',
        },
      },
      {
        id: 'generate_docs',
        name: 'Generate Documentation',
        type: 'llm',
        config: {
          systemPrompt: 'Generate comprehensive documentation for the analyzed code, including function descriptions, parameters, return values, and usage examples.',
          model: 'claude-3-5-sonnet-20241022',
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'analyze_code', target: 'generate_docs' },
      { id: 'e2', source: 'generate_docs', target: 'END' },
    ],
    entryPoint: 'analyze_code',
  };
}