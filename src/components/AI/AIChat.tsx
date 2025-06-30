import React, { useState, useRef, useEffect } from 'react';
import { Send, Settings, Bot, User } from 'lucide-react';
import { fetch } from '@tauri-apps/plugin-http';
import { MessageRenderer } from './MessageRenderer';
import { readDir, readTextFile } from '@tauri-apps/plugin-fs';
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
  selectedFile?: string | null;
}

export const AIChat: React.FC<AIChatProps> = ({ selectedCode, rootPath, selectedFile }) => {
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

  // Function to find and read files mentioned in the user's message
  const findAndReadFiles = async (message: string, rootPath: string): Promise<{ [filename: string]: string }> => {
    const fileContents: { [filename: string]: string } = {};
    
    // Common file extensions to look for
    const fileExtensions = [
      '.py', '.js', '.jsx', '.ts', '.tsx', '.java', '.cpp', '.c', '.h', '.cs', 
      '.rb', '.go', '.rs', '.php', '.swift', '.kt', '.scala', '.r', '.m', '.mm',
      '.html', '.css', '.scss', '.sass', '.less', '.json', '.xml', '.yaml', '.yml',
      '.md', '.txt', '.sql', '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat',
      '.dockerfile', '.dockerignore', '.gitignore', '.env', '.config'
    ];
    
    // Extract potential filenames from the message
    const words = message.split(/\s+/);
    const potentialFiles: string[] = [];
    
    for (const word of words) {
      // Check if word contains a file extension
      for (const ext of fileExtensions) {
        if (word.toLowerCase().includes(ext)) {
          // Clean up the word to get just the filename
          let filename = word.replace(/['"`,;:!?\(\)\[\]{}]/g, '');
          potentialFiles.push(filename);
        }
      }
    }
    
    // Also check if the currently selected file is mentioned
    if (selectedFile) {
      const selectedFileName = selectedFile.split('/').pop() || '';
      if (message.toLowerCase().includes(selectedFileName.toLowerCase())) {
        potentialFiles.push(selectedFile);
      }
    }
    
    // Try to read each potential file
    for (const filename of potentialFiles) {
      try {
        let fullPath: string;
        
        // If it's already a path from selectedFile, use it directly
        if (filename === selectedFile) {
          fullPath = `${rootPath}/${filename}`;
        } else {
          // Search for the file in the project
          const searchResults = await searchForFile(rootPath, filename);
          if (searchResults.length > 0) {
            fullPath = searchResults[0];
          } else {
            continue;
          }
        }
        
        const content = await readTextFile(fullPath);
        const relativePath = fullPath.replace(`${rootPath}/`, '');
        fileContents[relativePath] = content;
      } catch (error) {
        console.error(`Could not read file ${filename}:`, error);
      }
    }
    
    return fileContents;
  };

  // Helper function to search for a file in the project
  const searchForFile = async (rootPath: string, filename: string, currentPath: string = ''): Promise<string[]> => {
    const results: string[] = [];
    
    try {
      const fullPath = currentPath ? `${rootPath}/${currentPath}` : rootPath;
      const entries = await readDir(fullPath);
      
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'target') {
          continue;
        }
        
        const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
        
        if (entry.isDirectory) {
          // Recursively search subdirectories
          const subResults = await searchForFile(rootPath, filename, entryPath);
          results.push(...subResults);
        } else if (entry.name.toLowerCase() === filename.toLowerCase() || entry.name.toLowerCase().endsWith(filename.toLowerCase())) {
          results.push(`${rootPath}/${entryPath}`);
        }
      }
    } catch (error) {
      console.error('Error searching directory:', error);
    }
    
    return results;
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
      let fileContext = '';
      
      // Add project structure context if root path is available
      if (rootPath) {
        try {
          const entries = await readDir(rootPath);
          const projectFiles = entries
            .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== 'target')
            .map(e => e.isDirectory ? `${e.name}/` : e.name)
            .slice(0, 20);
          projectContext = `\n\nProject root: ${rootPath}\nMain files/folders: ${projectFiles.join(', ')}`;
          
          // Find and read files mentioned in the user's message
          const mentionedFiles = await findAndReadFiles(input, rootPath);
          
          if (Object.keys(mentionedFiles).length > 0) {
            fileContext = '\n\n--- Referenced Files ---\n';
            for (const [filepath, content] of Object.entries(mentionedFiles)) {
              // Limit file content to prevent token overflow
              const truncatedContent = content.length > 3000 
                ? content.substring(0, 3000) + '\n... (truncated)'
                : content;
              
              fileContext += `\nFile: ${filepath}\n\`\`\`\n${truncatedContent}\n\`\`\`\n`;
            }
          }
        } catch (err) {
          console.error('Error reading project structure:', err);
        }
      }
      
      if (selectedCode) {
        context = `Selected code:\n\`\`\`\n${selectedCode}\n\`\`\`\n\nQuestion: ${input}${projectContext}${fileContext}`;
      } else {
        context = input + projectContext + fileContext;
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

When the user mentions a file in their message, I will automatically read and include its contents in the context for you to analyze. You can provide specific feedback about the code, identify issues, and suggest improvements.

When providing code examples:
- Include filenames in code fences like: \`\`\`javascript src/components/Example.tsx
- Use relative paths from the project root (e.g., "src/components/File.tsx" not "project-name/src/components/File.tsx")
- Do NOT include the project folder name in file paths
- Be specific about where files should be created or modified
- Consider the project structure and existing files when suggesting changes
- When you see file contents in the context, analyze them thoroughly and provide specific, actionable feedback

Provide clear, concise answers focused on programming and development. When analyzing files, point out specific issues, bugs, or improvements with line-by-line suggestions when appropriate.`,
          temperature: 0.7,
          max_tokens: 4000,
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
                  <MessageRenderer 
                    content={message.content} 
                    rootPath={rootPath || null}
                  />
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