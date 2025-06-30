import React, { useState } from 'react';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpen } from 'lucide-react';
import { FileTree } from '../FileTree/FileTree';
import { EditorComponent } from '../Editor/Editor';
import { Terminal } from '../Terminal/PtyTerminal';
import { AIChat } from '../AI/AIChat';
import './Layout.css';

export const Layout: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [fileTreeRefreshTrigger, setFileTreeRefreshTrigger] = useState(0);

  const handleFileSelect = (path: string) => {
    setSelectedFile(path);
  };

  const handleOpenFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select a folder to open'
      });
      
      if (selected && typeof selected === 'string') {
        setCurrentFolder(selected);
        setSelectedFile(null); // Clear selected file when changing folders
      }
    } catch (error) {
      console.error('Error opening folder:', error);
    }
  };

  const handleTerminalOutput = (data: string) => {
    // Check if the output suggests file system changes
    const fileOperationPatterns = [
      /^(rm|rmdir|mkdir|touch|mv|cp)/,
      /removed?|deleted?|created?|moved?|copied?/i,
      /^(npm|yarn|pnpm) (install|add|remove)/,
      /^git (clone|pull|checkout|merge)/,
    ];
    
    const shouldRefresh = fileOperationPatterns.some(pattern => pattern.test(data));
    if (shouldRefresh) {
      // Trigger refresh with a small delay to ensure file operations are complete
      setTimeout(() => {
        setFileTreeRefreshTrigger(prev => prev + 1);
      }, 500);
    }
  };

  return (
    <div className="ide-layout">
      <div className="ide-header">
        <h1>Cody Editor</h1>
        <button className="open-folder-btn" onClick={handleOpenFolder}>
          <FolderOpen size={16} />
          <span>Open Folder</span>
        </button>
      </div>
      <div className="ide-body">
        <Allotment>
          <Allotment.Pane minSize={200} maxSize={400} preferredSize={250}>
            <FileTree 
              onFileSelect={handleFileSelect} 
              rootPath={currentFolder}
            />
          </Allotment.Pane>
          <Allotment.Pane>
            <Allotment>
              <Allotment.Pane preferredSize="70%">
                <Allotment vertical>
                  <Allotment.Pane preferredSize="70%">
                    <EditorComponent 
                      filePath={selectedFile} 
                      rootPath={currentFolder}
                      onSave={() => console.log('File saved')}
                    />
                  </Allotment.Pane>
                  <Allotment.Pane>
                    <Terminal workingDirectory={currentFolder} />
                  </Allotment.Pane>
                </Allotment>
              </Allotment.Pane>
              <Allotment.Pane>
                <AIChat selectedCode="" rootPath={currentFolder} />
              </Allotment.Pane>
            </Allotment>
          </Allotment.Pane>
        </Allotment>
      </div>
    </div>
  );
};