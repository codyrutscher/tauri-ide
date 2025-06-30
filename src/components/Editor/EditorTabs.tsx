import React, { useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { FaTimes, FaSave, FaSpinner } from 'react-icons/fa';
import { EditorComponent } from './Editor';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import './EditorTabs.css';

interface Tab {
  path: string;
  content?: string;
}

interface EditorTabsProps {
  rootPath: string | null;
  onSave: () => void;
}

export interface EditorTabsRef {
  openFile: (path: string) => void;
}

export const EditorTabs = forwardRef<EditorTabsRef, EditorTabsProps>(({ rootPath, onSave }, ref) => {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [modifiedFiles, setModifiedFiles] = useState<Map<string, string>>(new Map());
  const [isSavingAll, setIsSavingAll] = useState(false);

  const openFile = useCallback((filePath: string) => {
    const existingTab = tabs.find(tab => tab.path === filePath);
    if (!existingTab) {
      setTabs(prev => [...prev, { path: filePath }]);
    }
    setActiveTab(filePath);
  }, [tabs]);

  useImperativeHandle(ref, () => ({
    openFile,
  }), [openFile]);

  const closeTab = useCallback((filePath: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    
    if (modifiedFiles.has(filePath)) {
      const confirmClose = window.confirm(
        `"${filePath.split('/').pop()}" has unsaved changes. Close anyway?`
      );
      if (!confirmClose) return;
    }

    setTabs(prev => prev.filter(tab => tab.path !== filePath));
    setModifiedFiles(prev => {
      const newMap = new Map(prev);
      newMap.delete(filePath);
      return newMap;
    });
    
    if (activeTab === filePath) {
      const remainingTabs = tabs.filter(tab => tab.path !== filePath);
      setActiveTab(remainingTabs.length > 0 ? remainingTabs[remainingTabs.length - 1].path : null);
    }
  }, [tabs, activeTab, modifiedFiles]);

  const handleModifiedChange = useCallback((filePath: string, isModified: boolean) => {
    if (!isModified) {
      setModifiedFiles(prev => {
        const newMap = new Map(prev);
        newMap.delete(filePath);
        return newMap;
      });
    }
  }, []);

  const trackModifiedContent = useCallback((filePath: string, content: string) => {
    setModifiedFiles(prev => {
      const newMap = new Map(prev);
      newMap.set(filePath, content);
      return newMap;
    });
  }, []);

  const handleSaveAll = async () => {
    if (!rootPath || modifiedFiles.size === 0) return;
    
    setIsSavingAll(true);
    
    try {
      const savePromises = Array.from(modifiedFiles.entries()).map(async ([filePath, content]) => {
        const fullPath = `${rootPath}/${filePath}`;
        await writeTextFile(fullPath, content);
      });
      
      await Promise.all(savePromises);
      
      // Clear all modified files
      setModifiedFiles(new Map());
      
      // Trigger the onSave callback to refresh file tree
      onSave();
      
      // Show success feedback
      setTimeout(() => {
        setIsSavingAll(false);
      }, 1000);
    } catch (error) {
      console.error('Error saving files:', error);
      setIsSavingAll(false);
    }
  };

  const handleTabSave = useCallback(() => {
    setModifiedFiles(prev => {
      const newMap = new Map(prev);
      if (activeTab) {
        newMap.delete(activeTab);
      }
      return newMap;
    });
    onSave();
  }, [activeTab, onSave]);

  return (
    <div className="editor-tabs-container">
      <div className="editor-tabs-header">
        <div className="editor-tabs-list">
          {tabs.map(tab => (
            <div
              key={tab.path}
              className={`editor-tab ${activeTab === tab.path ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.path)}
            >
              <span className="editor-tab-name">
                {tab.path.split('/').pop()}
                {modifiedFiles.has(tab.path) && <span className="editor-tab-modified">●</span>}
              </span>
              <button
                className="editor-tab-close"
                onClick={(e) => closeTab(tab.path, e)}
              >
                <FaTimes size={10} />
              </button>
            </div>
          ))}
        </div>
        {modifiedFiles.size > 0 && (
          <button
            className={`editor-save-all-btn ${isSavingAll ? 'saving' : ''}`}
            onClick={handleSaveAll}
            disabled={isSavingAll}
            title={`Save all (${modifiedFiles.size} files)`}
          >
            {isSavingAll ? (
              <>
                <FaSpinner className="spinning" size={12} />
                Saving All...
              </>
            ) : (
              <>
                <FaSave size={12} />
                Save All ({modifiedFiles.size})
              </>
            )}
          </button>
        )}
      </div>
      <div className="editor-tabs-content">
        {activeTab ? (
          <EditorComponent
            key={activeTab}
            filePath={activeTab}
            rootPath={rootPath}
            onSave={handleTabSave}
            onModifiedChange={handleModifiedChange}
          />
        ) : (
          <div className="editor-empty">
            <h2>No file selected</h2>
            <p>Select a file from the explorer to start editing</p>
          </div>
        )}
      </div>
    </div>
  );
});