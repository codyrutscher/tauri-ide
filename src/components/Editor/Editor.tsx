import React, { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { FaSave, FaCheck, FaSpinner } from 'react-icons/fa';
import './Editor.css';

interface EditorComponentProps {
  filePath: string | null;
  rootPath?: string | null;
  onSave?: (content: string) => void;
  onModifiedChange?: (filePath: string, isModified: boolean) => void;
  theme?: string;
}

export const EditorComponent: React.FC<EditorComponentProps> = ({ filePath, rootPath, onSave, onModifiedChange, theme = 'vs-dark' }) => {
  const editorRef = useRef<any>(null);
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [language, setLanguage] = useState('plaintext');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isModified, setIsModified] = useState(false);

  useEffect(() => {
    if (filePath) {
      loadFile(filePath);
    } else {
      setContent('');
      setOriginalContent('');
      setLanguage('plaintext');
      setIsModified(false);
    }
  }, [filePath, rootPath]);

  useEffect(() => {
    const modified = content !== originalContent;
    setIsModified(modified);
    if (onModifiedChange && filePath) {
      onModifiedChange(filePath, modified);
    }
  }, [content, originalContent, filePath, onModifiedChange]);

  const loadFile = async (path: string) => {
    try {
      if (!rootPath) {
        console.error('No root path set');
        return;
      }
      
      const fullPath = `${rootPath}/${path}`;
      console.log(`Loading file: ${fullPath}`);
      
      const fileContent = await readTextFile(fullPath);
      setContent(fileContent);
      setOriginalContent(fileContent);
      setLanguage(getLanguageFromPath(path));
      setIsModified(false);
      
      console.log(`File loaded successfully: ${path}`);
    } catch (error) {
      console.error('Error loading file:', error);
      // Try to show a helpful error message
      setContent(`Error loading file: ${error}\n\nFile path: ${rootPath}/${path}`);
      setOriginalContent('');
      setIsModified(false);
    }
  };

  const getLanguageFromPath = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase();
    const languageMap: { [key: string]: string } = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'json': 'json',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'md': 'markdown',
      'rs': 'rust',
      'go': 'go',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'h': 'c',
      'hpp': 'cpp',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'swift': 'swift',
      'kt': 'kotlin',
      'sql': 'sql',
      'sh': 'shell',
      'bash': 'shell',
      'yml': 'yaml',
      'yaml': 'yaml',
      'xml': 'xml',
      'toml': 'toml',
      'vue': 'vue',
      'svelte': 'svelte',
      'dockerfile': 'dockerfile',
      'gitignore': 'plaintext',
      'env': 'plaintext',
      'conf': 'plaintext',
      'config': 'plaintext',
      'lock': 'json',
    };
    return languageMap[ext || ''] || 'plaintext';
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    
    // Add save shortcut
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave();
    });
  };

  const handleSave = async () => {
    if (!filePath || !editorRef.current || !rootPath) return;
    
    setSaveState('saving');
    const currentContent = editorRef.current.getValue();
    
    try {
      const fullPath = `${rootPath}/${filePath}`;
      await writeTextFile(fullPath, currentContent);
      
      setOriginalContent(currentContent);
      setIsModified(false);
      setSaveState('saved');
      
      // Show saved state for 2 seconds
      setTimeout(() => {
        setSaveState('idle');
      }, 2000);
      
      if (onSave) {
        onSave(currentContent);
      }
    } catch (error) {
      console.error('Error saving file:', error);
      setSaveState('idle');
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setContent(value);
    }
  };

  if (!rootPath) {
    return (
      <div className="editor-empty">
        <h2>Welcome to Cody Editor</h2>
        <p>Click "Open Folder" to browse and edit files</p>
      </div>
    );
  }
  
  if (!filePath) {
    return (
      <div className="editor-empty">
        <h2>No file selected</h2>
        <p>Select a file from the explorer to start editing</p>
      </div>
    );
  }

  return (
    <div className="editor-container">
      <div className="editor-header">
        <span className="editor-filename">
          {filePath.split('/').pop()}
          {isModified && <span className="editor-modified-indicator">●</span>}
        </span>
        <button 
          className={`editor-save-btn ${saveState}`} 
          onClick={handleSave}
          disabled={saveState === 'saving' || !isModified}
        >
          {saveState === 'saving' && <FaSpinner className="spinning" size={12} />}
          {saveState === 'saved' && <FaCheck size={12} />}
          {saveState === 'idle' && <FaSave size={12} />}
          <span>
            {saveState === 'saving' ? 'Saving...' : 
             saveState === 'saved' ? 'Saved!' : 
             'Save'}
          </span>
        </button>
      </div>
      <Editor
        height="calc(100% - 40px)"
        language={language}
        value={content}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        theme={theme}
        options={{
          minimap: { enabled: true },
          fontSize: 14,
          lineNumbers: 'on',
          rulers: [80],
          wordWrap: 'off',
          scrollBeyondLastLine: false,
          renderWhitespace: 'selection',
          tabSize: 2,
          insertSpaces: true,
          autoClosingBrackets: 'always',
          autoClosingQuotes: 'always',
          formatOnPaste: true,
          formatOnType: true,
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnEnter: 'on',
          folding: true,
          foldingStrategy: 'indentation',
          showFoldingControls: 'always',
          matchBrackets: 'always',
          renderLineHighlight: 'all',
          selectionHighlight: true,
          occurrencesHighlight: 'off',
        }}
      />
    </div>
  );
};