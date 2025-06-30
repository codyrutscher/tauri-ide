import React, { useState, useEffect, useCallback } from 'react';
import { FaFolder, FaFolderOpen, FaFile, FaChevronRight, FaChevronDown, FaSync, FaPlus } from 'react-icons/fa';
import { readDir, writeTextFile, mkdir, remove, rename } from '@tauri-apps/plugin-fs';
import { ContextMenu } from './ContextMenu';
import { InputDialog } from './InputDialog';
import './FileTree.css';

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
  isExpanded?: boolean;
}

interface FileTreeProps {
  onFileSelect: (path: string) => void;
  rootPath?: string | null;
  refreshTrigger?: number;
}

export const FileTree: React.FC<FileTreeProps> = ({ onFileSelect, rootPath, refreshTrigger }) => {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentRoot, setCurrentRoot] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: FileNode | null;
    parentPath: string[];
  } | null>(null);
  const [inputDialog, setInputDialog] = useState<{
    type: 'newFile' | 'newFolder' | 'rename';
    node?: FileNode;
    parentPath?: string[];
  } | null>(null);

  useEffect(() => {
    if (rootPath) {
      setCurrentRoot(rootPath);
      setTree([]); // Clear existing tree
      loadRootDirectory(rootPath);
    } else {
      setTree([]);
      setLoading(false);
    }
  }, [rootPath]);

  // Refresh when triggered externally
  useEffect(() => {
    if (refreshTrigger && rootPath && !loading) {
      refreshTree();
    }
  }, [refreshTrigger]);

  const refreshTree = useCallback(async () => {
    if (!rootPath || isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      // Save expanded state
      const expandedPaths = new Set<string>();
      const collectExpanded = (nodes: FileNode[]) => {
        nodes.forEach(node => {
          if (node.isExpanded) {
            expandedPaths.add(node.path);
          }
          if (node.children) {
            collectExpanded(node.children);
          }
        });
      };
      collectExpanded(tree);

      // Force a fresh read of the directory
      const entries = await readDir(rootPath);
      console.log(`Refreshing tree: found ${entries.length} entries in ${rootPath}`);
      
      // Build new tree with expanded state preserved
      const newTree = await buildTreeFromEntries(entries, '', expandedPaths);
      setTree(newTree);
      
      // If no files were found, it might be a permission issue
      if (entries.length === 0) {
        console.warn('No entries found in directory. Check permissions.');
      }
    } catch (error) {
      console.error('Error refreshing tree:', error);
      // Try to recover by clearing and reloading
      setTree([]);
      setTimeout(() => loadRootDirectory(rootPath), 100);
    } finally {
      setIsRefreshing(false);
    }
  }, [rootPath, tree, isRefreshing]);

  const buildTreeFromEntries = async (
    entries: any[], 
    parentPath: string, 
    expandedPaths: Set<string>
  ): Promise<FileNode[]> => {
    const nodes: FileNode[] = await Promise.all(
      entries
        .filter((entry: any) => {
          // More permissive filtering - only skip truly hidden files
          if (entry.name.startsWith('.') && entry.name !== '.gitignore') {
            return false;
          }
          return true;
        })
        .map(async (entry: any) => {
          const nodePath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
          const node: FileNode = {
            name: entry.name,
            path: nodePath,
            isDirectory: entry.isDirectory || false,
            children: entry.isDirectory ? [] : undefined,
            isExpanded: expandedPaths.has(nodePath),
          };

          // Load children for expanded directories
          if (node.isDirectory && node.isExpanded && rootPath) {
            try {
              const childEntries = await readDir(`${rootPath}/${nodePath}`);
              node.children = await buildTreeFromEntries(childEntries, nodePath, expandedPaths);
            } catch (error) {
              console.error(`Error loading children for ${nodePath}:`, error);
              node.children = [];
            }
          }

          return node;
        })
    );

    return nodes.sort((a, b) => {
      if (a.isDirectory === b.isDirectory) {
        return a.name.localeCompare(b.name);
      }
      return a.isDirectory ? -1 : 1;
    });
  };

  const loadRootDirectory = async (rootPath: string) => {
    try {
      setLoading(true);
      const entries = await readDir(rootPath);
      
      const nodes: FileNode[] = await Promise.all(
        entries
          .filter((entry: any) => {
            // More permissive filtering for root directory
            if (entry.name.startsWith('.') && entry.name !== '.gitignore') {
              return false;
            }
            return true;
          })
          .map(async (entry: any) => ({
            name: entry.name,
            path: entry.name, // Just the filename for root level
            isDirectory: entry.isDirectory || false,
            children: entry.isDirectory ? [] : undefined,
            isExpanded: false,
          }))
      );

      setTree(nodes.sort((a, b) => {
        if (a.isDirectory === b.isDirectory) {
          return a.name.localeCompare(b.name);
        }
        return a.isDirectory ? -1 : 1;
      }));
    } catch (error) {
      console.error('Error loading root directory:', error);
      setTree([]);
    } finally {
      setLoading(false);
    }
  };


  const handleContextMenu = (e: React.MouseEvent, node: FileNode | null, parentPath: string[] = []) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      node,
      parentPath,
    });
  };

  const toggleDirectory = async (node: FileNode, parentPath: string[] = []) => {
    if (!node.isDirectory) {
      // Ensure we can select any file, including newly created ones
      console.log(`Selected file: ${node.path}`);
      onFileSelect(node.path);
      return;
    }

    const updateTree = (nodes: FileNode[], path: string[]): FileNode[] => {
      if (path.length === 0) {
        return nodes.map(n => {
          if (n.name === node.name && n.path === node.path) {
            return { ...n, isExpanded: !n.isExpanded };
          }
          return n;
        });
      }

      const [current, ...rest] = path;
      return nodes.map(n => {
        if (n.name === current && n.children) {
          return { ...n, children: updateTree(n.children, rest) };
        }
        return n;
      });
    };

    // First toggle the expansion state
    setTree(prev => updateTree(prev, parentPath));
    
    // Then load children if needed
    if (!node.isExpanded && (!node.children || node.children.length === 0)) {
      await loadChildrenForNode(node, parentPath);
    }
  };

  const loadChildrenForNode = async (node: FileNode, parentPath: string[] = []) => {
    try {
      const root = currentRoot || rootPath;
      if (!root) return;
      
      const fullPath = `${root}/${node.path}`;
      const entries = await readDir(fullPath);
      console.log(`Loading children for ${fullPath}, found ${entries.length} entries`);
      
      const children: FileNode[] = entries
        .filter((entry: any) => {
          // More permissive filtering
          if (entry.name.startsWith('.') && entry.name !== '.gitignore') {
            return false;
          }
          return true;
        })
        .map((entry: any) => {
          console.log(`  - ${entry.name} (${entry.isDirectory ? 'dir' : 'file'})`);
          return {
            name: entry.name,
            path: `${node.path}/${entry.name}`,
            isDirectory: entry.isDirectory || false,
            children: entry.isDirectory ? [] : undefined,
            isExpanded: false,
          };
        });

      const sortedChildren = children.sort((a, b) => {
        if (a.isDirectory === b.isDirectory) {
          return a.name.localeCompare(b.name);
        }
        return a.isDirectory ? -1 : 1;
      });

      // Update the tree with the loaded children
      const updateTreeWithChildren = (nodes: FileNode[], path: string[]): FileNode[] => {
        if (path.length === 0) {
          return nodes.map(n => {
            if (n.name === node.name && n.path === node.path) {
              return { ...n, children: sortedChildren };
            }
            return n;
          });
        }

        const [current, ...rest] = path;
        return nodes.map(n => {
          if (n.name === current && n.children) {
            return { ...n, children: updateTreeWithChildren(n.children, rest) };
          }
          return n;
        });
      };

      setTree(prev => updateTreeWithChildren(prev, parentPath));
    } catch (error) {
      console.error('Error loading children:', error);
    }
  };

  const handleNewFile = async (name: string) => {
    if (!rootPath || !inputDialog) return;
    
    try {
      let targetPath = '';
      
      // If we have a node that's a directory, create inside it
      if (inputDialog.node && inputDialog.node.isDirectory) {
        targetPath = inputDialog.node.path;
      }
      // If we have a node that's a file, create in its parent directory
      else if (inputDialog.node && !inputDialog.node.isDirectory) {
        const pathParts = inputDialog.node.path.split('/');
        pathParts.pop(); // Remove the file name
        targetPath = pathParts.join('/');
      }
      // Otherwise, create in root
      
      const filePath = targetPath ? `${rootPath}/${targetPath}/${name}` : `${rootPath}/${name}`;
      
      console.log(`Creating file at: ${filePath}`);
      
      // Create empty file
      await writeTextFile(filePath, '');
      
      // If creating inside a directory, make sure it's expanded
      if (inputDialog.node && inputDialog.node.isDirectory && inputDialog.parentPath) {
        // Expand the parent directory if it's not already
        if (!inputDialog.node.isExpanded) {
          await toggleDirectory(inputDialog.node, inputDialog.parentPath);
        }
      }
      
      // Refresh tree
      await refreshTree();
      
      // Select the new file
      const newFilePath = targetPath ? `${targetPath}/${name}` : name;
      onFileSelect(newFilePath);
    } catch (error) {
      console.error('Failed to create file:', error);
    }
    
    setInputDialog(null);
  };

  const handleNewFolder = async (name: string) => {
    if (!rootPath || !inputDialog) return;
    
    try {
      let targetPath = '';
      
      // If we have a node that's a directory, create inside it
      if (inputDialog.node && inputDialog.node.isDirectory) {
        targetPath = inputDialog.node.path;
      }
      // If we have a node that's a file, create in its parent directory
      else if (inputDialog.node && !inputDialog.node.isDirectory) {
        const pathParts = inputDialog.node.path.split('/');
        pathParts.pop(); // Remove the file name
        targetPath = pathParts.join('/');
      }
      // Otherwise, create in root
      
      const folderPath = targetPath ? `${rootPath}/${targetPath}/${name}` : `${rootPath}/${name}`;
      
      console.log(`Creating folder at: ${folderPath}`);
      
      // Create directory
      await mkdir(folderPath, { recursive: true });
      
      // If creating inside a directory, make sure it's expanded
      if (inputDialog.node && inputDialog.node.isDirectory && inputDialog.parentPath) {
        // Expand the parent directory if it's not already
        if (!inputDialog.node.isExpanded) {
          await toggleDirectory(inputDialog.node, inputDialog.parentPath);
        }
      }
      
      // Refresh tree
      await refreshTree();
    } catch (error) {
      console.error('Failed to create folder:', error);
    }
    
    setInputDialog(null);
  };

  const handleRename = async (newName: string) => {
    if (!rootPath || !inputDialog || !inputDialog.node) return;
    
    try {
      const oldPath = `${rootPath}/${inputDialog.node.path}`;
      const parentDir = inputDialog.node.path.split('/').slice(0, -1).join('/');
      const newPath = parentDir 
        ? `${rootPath}/${parentDir}/${newName}`
        : `${rootPath}/${newName}`;
      
      // Rename file/folder
      await rename(oldPath, newPath);
      
      // Refresh tree
      await refreshTree();
    } catch (error) {
      console.error('Failed to rename:', error);
    }
    
    setInputDialog(null);
  };

  const handleDelete = async () => {
    if (!rootPath || !contextMenu || !contextMenu.node) return;
    
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${contextMenu.node.name}"?`
    );
    
    if (!confirmDelete) {
      setContextMenu(null);
      return;
    }
    
    try {
      const fullPath = `${rootPath}/${contextMenu.node.path}`;
      
      // Remove file/folder
      await remove(fullPath, { recursive: true });
      
      // Refresh tree
      await refreshTree();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
    
    setContextMenu(null);
  };

  const renderTree = (nodes: FileNode[], level: number = 0, parentPath: string[] = []): JSX.Element[] => {
    return nodes.map((node) => (
      <div key={node.path}>
        <div
          className="file-tree-item"
          style={{ paddingLeft: `${level * 20 + 10}px` }}
          onClick={() => toggleDirectory(node, parentPath)}
          onContextMenu={(e) => handleContextMenu(e, node, parentPath)}
        >
          {node.isDirectory ? (
            <>
              {node.isExpanded ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />}
              {node.isExpanded ? <FaFolderOpen /> : <FaFolder />}
            </>
          ) : (
            <>
              <span style={{ width: 12 }} />
              <FaFile />
            </>
          )}
          <span className="file-name">{node.name}</span>
        </div>
        {node.isDirectory && node.isExpanded && node.children && (
          <div>{renderTree(node.children, level + 1, [...parentPath, node.name])}</div>
        )}
      </div>
    ));
  };

  if (loading) {
    return <div className="file-tree-loading">Loading...</div>;
  }

  return (
    <div className="file-tree">
      <div className="file-tree-header">
        <div className="file-tree-header-title">
          <span>Explorer</span>
          {rootPath && (
            <div className="file-tree-header-actions">
              <button 
                className="file-tree-action-btn" 
                onClick={() => setInputDialog({ type: 'newFile' })}
                title="New File"
              >
                <FaFile size={12} />
              </button>
              <button 
                className="file-tree-action-btn" 
                onClick={() => setInputDialog({ type: 'newFolder' })}
                title="New Folder"
              >
                <FaFolder size={12} />
              </button>
              <button 
                className="file-tree-action-btn" 
                onClick={refreshTree}
                disabled={isRefreshing}
                title="Refresh file tree"
              >
                <FaSync className={isRefreshing ? 'spinning' : ''} size={12} />
              </button>
            </div>
          )}
        </div>
        {rootPath && (
          <div className="file-tree-path" title={rootPath}>
            {rootPath.split('/').pop() || 'Root'}
          </div>
        )}
      </div>
      <div 
        className="file-tree-content"
        onContextMenu={(e) => {
          // Right-click on empty space = root directory context menu
          if (e.target === e.currentTarget && rootPath) {
            handleContextMenu(e, null, []);
          }
        }}
      >
        {tree.length === 0 && !loading ? (
          <div className="file-tree-empty">
            No folder opened. Click "Open Folder" to browse files.
          </div>
        ) : (
          renderTree(tree)
        )}
      </div>
      
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isDirectory={contextMenu.node ? contextMenu.node.isDirectory : true}
          onNewFile={() => {
            setInputDialog({ 
              type: 'newFile', 
              node: contextMenu.node || undefined,
              parentPath: contextMenu.parentPath
            });
            setContextMenu(null);
          }}
          onNewFolder={() => {
            setInputDialog({ 
              type: 'newFolder', 
              node: contextMenu.node || undefined,
              parentPath: contextMenu.parentPath
            });
            setContextMenu(null);
          }}
          onRename={() => {
            if (contextMenu.node) {
              setInputDialog({ 
                type: 'rename', 
                node: contextMenu.node,
                parentPath: contextMenu.parentPath 
              });
            }
            setContextMenu(null);
          }}
          onDelete={handleDelete}
          onClose={() => setContextMenu(null)}
        />
      )}
      
      {inputDialog && (
        <InputDialog
          title={
            inputDialog.type === 'newFile' ? 'New File' :
            inputDialog.type === 'newFolder' ? 'New Folder' :
            'Rename'
          }
          placeholder={
            inputDialog.type === 'newFile' ? 'Enter file name' :
            inputDialog.type === 'newFolder' ? 'Enter folder name' :
            'Enter new name'
          }
          initialValue={inputDialog.type === 'rename' ? inputDialog.node?.name : ''}
          onConfirm={(value) => {
            if (inputDialog.type === 'newFile') {
              handleNewFile(value);
            } else if (inputDialog.type === 'newFolder') {
              handleNewFolder(value);
            } else if (inputDialog.type === 'rename') {
              handleRename(value);
            }
          }}
          onCancel={() => setInputDialog(null)}
        />
      )}
    </div>
  );
};