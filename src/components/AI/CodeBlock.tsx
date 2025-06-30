import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, FileCode } from 'lucide-react';
import './CodeBlock.css';

interface CodeBlockProps {
  language?: string;
  value: string;
  filename?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ 
  language = 'text', 
  value, 
  filename
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };


  return (
    <div className="code-block-container">
      <div className="code-block-header">
        <div className="code-block-info">
          {filename && (
            <>
              <FileCode size={14} />
              <span className="code-block-filename">{filename}</span>
            </>
          )}
          <span className="code-block-language">{language}</span>
        </div>
        <div className="code-block-actions">
          <button
            className="code-block-btn"
            onClick={handleCopy}
            title="Copy code"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>
      </div>
      <div className="code-block-content">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: '12px',
            background: '#1e1e1e',
            fontSize: '13px',
            lineHeight: '1.5',
          }}
          codeTagProps={{
            style: {
              fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            }
          }}
        >
          {value}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};