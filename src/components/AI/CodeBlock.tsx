import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, FileCode, FolderPlus } from 'lucide-react';
import { writeTextFile, mkdir } from '@tauri-apps/plugin-fs';
import { dirname } from '@tauri-apps/api/path';
import './CodeBlock.css';

interface CodeBlockProps {
  language?: string;
  value: string;
  filename?: string;
  rootPath?: string | null;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ 
  language = 'text', 
  value, 
  filename,
  rootPath 
}) => {
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleApply = async () => {
    if (!filename || !rootPath) {
      setError('No file path or root directory specified');
      return;
    }

    try {
      const fullPath = `${rootPath}/${filename}`;
      
      // Create directory if it doesn't exist
      const dir = await dirname(fullPath);
      try {
        await mkdir(dir, { recursive: true });
      } catch (e) {
        // Directory might already exist, that's fine
      }

      // Write the file
      await writeTextFile(fullPath, value);
      
      setApplied(true);
      setError(null);
      setTimeout(() => setApplied(false), 3000);
    } catch (err) {
      console.error('Failed to apply code:', err);
      setError(`Failed to write file: ${err}`);
    }
  };

  const canApply = filename && rootPath;

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
          {canApply && (
            <button
              className={`code-block-btn ${applied ? 'applied' : ''}`}
              onClick={handleApply}
              title={`Create/Update ${filename}`}
            >
              <FileCode size={14} />
              <span>{applied ? 'Applied!' : 'Apply'}</span>
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="code-block-error">{error}</div>
      )}
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