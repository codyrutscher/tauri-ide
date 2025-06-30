import React, { useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import './Editor.css';

interface EditorComponentProps {
  filePath: string | null;
  rootPath?: string | null;
  onSave?: (content: string) => void;
}

export const EditorComponent: React.FC<EditorComponentProps> = ({ filePath, rootPath, onSave }) => {
  const editorRef = useRef<any>(null);
  const [content, setContent] = React.useState('');
  const [language, setLanguage] = React.useState('plaintext');

  useEffect(() => {
    if (filePath) {
      loadFile(filePath);
    } else {
      setContent('');
      setLanguage('plaintext');
    }
  }, [filePath, rootPath]);

  const loadFile = async (path: string) => {
    try {
      if (!rootPath) {
        console.error('No root path set');
        return;
      }
      
      const fullPath = `${rootPath}/${path}`;
      const fileContent = await readTextFile(fullPath);
      setContent(fileContent);
      setLanguage(getLanguageFromPath(path));
    } catch (error) {
      console.error('Error loading file:', error);
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
    
    const currentContent = editorRef.current.getValue();
    try {
      const fullPath = `${rootPath}/${filePath}`;
      await writeTextFile(fullPath, currentContent);
      if (onSave) {
        onSave(currentContent);
      }
    } catch (error) {
      console.error('Error saving file:', error);
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
        <span className="editor-filename">{filePath.split('/').pop()}</span>
        <button className="editor-save-btn" onClick={handleSave}>Save</button>
      </div>
      <Editor
        height="calc(100% - 40px)"
        language={language}
        value={content}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        theme="vs-dark"
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