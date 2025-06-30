import React, { useState, useCallback } from 'react';
import { BrowserWorkflowEngine, createSimpleCodeAssistantWorkflow } from '../workflows/browser-engine';
import { AgentState, Workflow } from '../types';
import { WorkflowBuilder } from './WorkflowBuilder';
import { FaRobot, FaCode, FaCog } from 'react-icons/fa';
import './LangGraphChat.css';

interface LangGraphChatProps {
  apiKey?: string;
  currentFile?: string | null;
  projectPath?: string | null;
}

export const LangGraphChat: React.FC<LangGraphChatProps> = ({
  apiKey,
  currentFile,
  projectPath,
}) => {
  const [mode, setMode] = useState<'chat' | 'workflow'>('chat');
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow>(createSimpleCodeAssistantWorkflow());
  const [workflowEngine, setWorkflowEngine] = useState<BrowserWorkflowEngine | null>(
    apiKey ? new BrowserWorkflowEngine(apiKey) : null
  );

  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || !workflowEngine || isProcessing) return;

    const userMessage = { role: 'user' as const, content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsProcessing(true);

    try {
      const state: Partial<AgentState> = {
        messages: [userMessage],
        currentFile,
        projectPath,
        context: {
          timestamp: new Date().toISOString(),
        },
      };

      const result = await workflowEngine.executeWorkflow(selectedWorkflow, state);

      if (result.success && result.output.messages) {
        const assistantMessage = result.output.messages[result.output.messages.length - 1];
        setMessages([...newMessages, {
          role: 'assistant',
          content: assistantMessage.content,
        }]);
      } else {
        setMessages([...newMessages, {
          role: 'assistant',
          content: `Error: ${result.error || 'Failed to execute workflow'}`,
        }]);
      }
    } catch (error) {
      setMessages([...newMessages, {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }]);
    } finally {
      setIsProcessing(false);
    }
  }, [input, workflowEngine, isProcessing, messages, selectedWorkflow, currentFile, projectPath]);

  const handleWorkflowSave = useCallback((workflow: Workflow) => {
    setSelectedWorkflow(workflow);
    // In a real app, you'd save this to storage
    console.log('Workflow saved:', workflow);
  }, []);

  const handleWorkflowExecute = useCallback(async (workflow: Workflow) => {
    if (!workflowEngine) {
      alert('Please configure your API key to execute workflows');
      return;
    }

    setSelectedWorkflow(workflow);
    setMode('chat');
    
    // Execute with current context
    const state: Partial<AgentState> = {
      messages: messages.filter(m => m.role === 'user').map(m => ({ 
        role: 'user' as const, 
        content: m.content 
      })),
      currentFile,
      projectPath,
    };

    setIsProcessing(true);
    try {
      const result = await workflowEngine.executeWorkflow(workflow, state);
      
      if (result.success) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Workflow "${workflow.name}" executed successfully!`,
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Workflow execution failed: ${result.error}`,
        }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error executing workflow: ${error}`,
      }]);
    } finally {
      setIsProcessing(false);
    }
  }, [workflowEngine, messages, currentFile, projectPath]);

  if (!apiKey) {
    return (
      <div className="langgraph-chat">
        <div className="api-key-prompt">
          <FaRobot size={48} />
          <h3>LangGraph Assistant</h3>
          <p>Please configure your Claude API key to use LangGraph features.</p>
          <p>You can set it in the AI Chat settings panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="langgraph-chat">
      <div className="langgraph-header">
        <div className="langgraph-tabs">
          <button
            className={`langgraph-tab ${mode === 'chat' ? 'active' : ''}`}
            onClick={() => setMode('chat')}
          >
            <FaRobot /> Chat
          </button>
          <button
            className={`langgraph-tab ${mode === 'workflow' ? 'active' : ''}`}
            onClick={() => setMode('workflow')}
          >
            <FaCog /> Workflow Builder
          </button>
        </div>
        {currentFile && (
          <div className="current-context">
            <FaCode /> {currentFile.split('/').pop()}
          </div>
        )}
      </div>

      {mode === 'chat' ? (
        <div className="langgraph-chat-view">
          <div className="workflow-info">
            Using workflow: <strong>{selectedWorkflow.name}</strong>
          </div>
          
          <div className="messages-container">
            {messages.map((message, index) => (
              <div key={index} className={`message ${message.role}`}>
                <div className="message-content">{message.content}</div>
              </div>
            ))}
            {isProcessing && (
              <div className="message assistant processing">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
          </div>

          <div className="input-container">
            <textarea
              className="message-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Ask about your code or describe what you want to build..."
              disabled={isProcessing}
            />
            <button
              className="send-button"
              onClick={handleSendMessage}
              disabled={!input.trim() || isProcessing}
            >
              Send
            </button>
          </div>
        </div>
      ) : (
        <WorkflowBuilder
          workflow={selectedWorkflow}
          onSave={handleWorkflowSave}
          onExecute={handleWorkflowExecute}
        />
      )}
    </div>
  );
};