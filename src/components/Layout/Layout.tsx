import React, { useState, useEffect } from 'react';
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

  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Shift + S = Save All
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 's') {
        e.preventDefault();
        // For now, we'll just show the concept
        console.log('Save All shortcut triggered');
        // In a full implementation, this would save all modified files
      }
      
      // Cmd/Ctrl + R = Refresh file tree
      if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault();
        console.log('Refreshing file tree...');
        setFileTreeRefreshTrigger(prev => prev + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
        console.log(`Opening new project: ${selected}`);
        // Reset all state for new project
        setCurrentFolder(selected);
        setSelectedFile(null); // Clear selected file when changing folders
        // Force refresh of file tree
        setFileTreeRefreshTrigger(prev => prev + 1);
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
      /^(npm|yarn|pnpm) (install|add|remove|create)/,
      /^git (clone|pull|checkout|merge)/,
      /create-react-app|create-next-app|django-admin|rails new|vue create|ng new/i,
      /successfully created|initialized|generated|scaffolded/i,
      /writing|creating|adding|installing/i,
      /✔|✓|done|complete|finished/i,
    ];
    
    const shouldRefresh = fileOperationPatterns.some(pattern => pattern.test(data));
    if (shouldRefresh) {
      // Trigger refresh with a small delay to ensure file operations are complete
      setTimeout(() => {
        setFileTreeRefreshTrigger(prev => prev + 1);
      }, 1000); // Increased delay for project generation
      
      // For large project generations, do multiple refreshes
      if (data.includes('create-react-app') || data.includes('django-admin') || 
          data.includes('rails new') || data.includes('successfully created') ||
          data.includes('Happy hacking!') || data.includes('Success!') ||
          data.includes('npm start') || data.includes('yarn start')) {
        // Immediate refresh
        console.log('Project creation detected - immediate refresh');
        setFileTreeRefreshTrigger(prev => prev + 1);
        
        // Refresh after 2 seconds
        setTimeout(() => {
          console.log('Project creation detected - refreshing file tree (2s)');
          setFileTreeRefreshTrigger(prev => prev + 1);
        }, 2000);
        
        // Refresh after 4 seconds
        setTimeout(() => {
          console.log('Project creation detected - refreshing file tree (4s)');
          setFileTreeRefreshTrigger(prev => prev + 1);
        }, 4000);
        
        // Final refresh after 6 seconds to catch any delayed file creation
        setTimeout(() => {
          console.log('Project creation detected - final refresh (6s)');
          setFileTreeRefreshTrigger(prev => prev + 1);
        }, 6000);
      }
    }
  };

  return (
    <div className="ide-layout">
      <div className="ide-header">
        <h1>Cody Editor</h1>
        <button className="open-folder-btn" onClick={handleOpenFolder}>
          <FolderOpen size={16} />
          <span>New Project</span>
        </button>
      </div>
      <div className="ide-body">
        <Allotment>
          <Allotment.Pane minSize={200} maxSize={400} preferredSize={250}>
            <FileTree 
              onFileSelect={handleFileSelect} 
              rootPath={currentFolder}
              refreshTrigger={fileTreeRefreshTrigger}
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
                      onSave={() => {
                        console.log('File saved');
                        // Trigger file tree refresh after save
                        setFileTreeRefreshTrigger(prev => prev + 1);
                      }}
                    />
                  </Allotment.Pane>
                  <Allotment.Pane>
                    <Terminal 
                      workingDirectory={currentFolder} 
                      onOutput={handleTerminalOutput}
                    />
                  </Allotment.Pane>
                </Allotment>
              </Allotment.Pane>
              <Allotment.Pane>
                <AIChat 
                  selectedCode="" 
                  rootPath={currentFolder}
                  selectedFile={selectedFile}
                />
              </Allotment.Pane>
            </Allotment>
          </Allotment.Pane>
        </Allotment>
      </div>
    </div>
  );
};