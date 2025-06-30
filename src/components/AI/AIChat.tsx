import React, { useState, useRef, useEffect } from 'react';
import { Send, Settings, Bot, User } from 'lucide-react';
import { fetch } from '@tauri-apps/plugin-http';
import { MessageRenderer } from './MessageRenderer';
import { readDir } from '@tauri-apps/plugin-fs';
import './AIChat.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIChatProps {
  selectedCode?: string;
  rootPath?: string | null;
}

export const AIChat: React.FC<AIChatProps> = ({ selectedCode, rootPath }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load API key from localStorage
    const savedKey = localStorage.getItem('anthropic_api_key');
    if (savedKey) {
      setApiKey(savedKey);
      setTempApiKey(savedKey);
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const saveApiKey = () => {
    localStorage.setItem('anthropic_api_key', tempApiKey);
    setApiKey(tempApiKey);
    setShowSettings(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    if (!apiKey) {
      setShowSettings(true);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Prepare context with selected code and project info if available
      let context = input;
      let projectContext = '';
      
      // Add project structure context if root path is available
      if (rootPath) {
        try {
          const entries = await readDir(rootPath);
          const projectFiles = entries
            .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== 'target')
            .map(e => e.isDirectory ? `${e.name}/` : e.name)
            .slice(0, 20);
          projectContext = `\n\nProject root: ${rootPath}\nMain files/folders: ${projectFiles.join(', ')}`;
        } catch (err) {
          console.error('Error reading project structure:', err);
        }
      }
      
      if (selectedCode) {
        context = `Selected code:\n\`\`\`\n${selectedCode}\n\`\`\`\n\nQuestion: ${input}${projectContext}`;
      } else {
        context = input + projectContext;
      }

      // Convert messages to Anthropic format
      const anthropicMessages = messages.map(m => ({
        role: m.role,
        content: m.content
      }));
      
      anthropicMessages.push({ role: 'user', content: context });

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          messages: anthropicMessages,
          system: `You are a helpful coding assistant integrated into an IDE similar to Cursor. You have access to the user's project files and can help them write, modify, and understand code. 

When providing code examples:
- Include filenames in code fences like: \`\`\`javascript src/components/Example.tsx
- Be specific about where files should be created or modified
- Consider the project structure and existing files when suggesting changes
- Use appropriate file paths relative to the project root

Provide clear, concise answers focused on programming and development. When creating new files, ensure they follow the project's existing conventions and structure.`,
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw {
          response: {
            status: response.status,
            data: errorData
          }
        };
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content[0].text,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Error sending message:', error);
      let errorContent = 'Sorry, I encountered an error. ';
      
      if (error.response) {
        // The request was made and the server responded with a status code
        if (error.response.status === 401) {
          errorContent += 'Invalid API key. Please check your Anthropic API key.';
        } else if (error.response.status === 429) {
          errorContent += 'Rate limit exceeded. Please try again later.';
        } else if (error.response.status === 400) {
          errorContent += 'Bad request. ' + (error.response.data?.error?.message || '');
        } else {
          errorContent += `Server error: ${error.response.status}. ${error.response.data?.error?.message || ''}`;
        }
      } else if (error.request) {
        // The request was made but no response was received
        errorContent += 'No response from server. Please check your internet connection.';
      } else {
        // Something happened in setting up the request
        errorContent += error.message || 'Unknown error occurred.';
      }
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorContent,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="ai-chat">
      <div className="ai-chat-header">
        <span>Claude Assistant</span>
        <button
          className="ai-settings-btn"
          onClick={() => setShowSettings(!showSettings)}
        >
          <Settings size={16} />
        </button>
      </div>

      {showSettings && (
        <div className="ai-settings">
          <h3>API Settings</h3>
          <input
            type="password"
            placeholder="Enter Anthropic API Key"
            value={tempApiKey}
            onChange={(e) => setTempApiKey(e.target.value)}
            className="api-key-input"
          />
          <button onClick={saveApiKey} className="save-api-key-btn">
            Save API Key
          </button>
        </div>
      )}

      <div className="ai-messages">
        {messages.map((message) => (
          <div key={message.id} className={`ai-message ${message.role}`}>
            <div className="message-icon">
              {message.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className="message-content">
              <div className="message-text">
                {message.role === 'assistant' ? (
                  <MessageRenderer content={message.content} rootPath={rootPath || null} />
                ) : (
                  message.content
                )}
              </div>
              <div className="message-time">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="ai-message assistant">
            <div className="message-icon">
              <Bot size={16} />
            </div>
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="ai-input-container">
        <textarea
          className="ai-input"
          placeholder={apiKey ? "Ask me anything..." : "Set API key first"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={!apiKey}
          rows={1}
        />
        <button
          className="ai-send-btn"
          onClick={sendMessage}
          disabled={!input.trim() || isLoading || !apiKey}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};