import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { CodeBlock } from './CodeBlock';
import './MessageRenderer.css';

interface MessageRendererProps {
  content: string;
  rootPath: string | null;
}

export const MessageRenderer: React.FC<MessageRendererProps> = ({ content, rootPath }) => {
  return (
    <div className="message-content">
      <ReactMarkdown
        components={{
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const language = match ? match[1] : '';
          let value = String(children).replace(/\n$/, '');
          
          // Extract filename from various formats:
          // 1. From code fence info string: ```language filename.ext
          // 2. From first line if it looks like a filename comment
          const codeInfo = (node as any)?.data?.meta || '';
          let filename = codeInfo.split(' ')[0] || undefined;
          
          // If no filename in meta, check if first line is a filename comment
          if (!filename && value) {
            const lines = value.split('\n');
            const firstLine = lines[0].trim();
            // Check for common filename comment patterns
            const filenamePatterns = [
              /^\/\/ (.+\.(js|jsx|ts|tsx|css|html|json|md))$/i,
              /^# (.+\.(py|sh|bash|yml|yaml))$/i,
              /^\/\* (.+\.(css|scss|less)) \*\/$/i,
              /^<!-- (.+\.(html|xml|svg)) -->$/i,
            ];
            
            for (const pattern of filenamePatterns) {
              const filenameMatch = firstLine.match(pattern);
              if (filenameMatch) {
                filename = filenameMatch[1];
                // Remove the filename line from the code
                value = lines.slice(1).join('\n');
                break;
              }
            }
          }
          
          if (!inline && language) {
            return (
              <CodeBlock
                language={language}
                value={value}
                filename={filename}
                rootPath={rootPath}
              />
            );
          }
          
          return (
            <code className="inline-code" {...props}>
              {children}
            </code>
          );
        },
        pre({ children }) {
          // Return children directly since we handle code blocks above
          return <>{children}</>;
        },
        p({ children }) {
          return <p className="message-paragraph">{children}</p>;
        },
        ul({ children }) {
          return <ul className="message-list">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="message-list message-list-ordered">{children}</ol>;
        },
        li({ children }) {
          return <li className="message-list-item">{children}</li>;
        },
        h1({ children }) {
          return <h1 className="message-heading message-h1">{children}</h1>;
        },
        h2({ children }) {
          return <h2 className="message-heading message-h2">{children}</h2>;
        },
        h3({ children }) {
          return <h3 className="message-heading message-h3">{children}</h3>;
        },
        blockquote({ children }) {
          return <blockquote className="message-blockquote">{children}</blockquote>;
        },
        a({ href, children }) {
          return (
            <a href={href} className="message-link" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          );
        },
        strong({ children }) {
          return <strong className="message-strong">{children}</strong>;
        },
        em({ children }) {
          return <em className="message-em">{children}</em>;
        },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};