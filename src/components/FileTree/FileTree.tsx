import React, { useState, useEffect, useCallback } from 'react';
import { FaFolder, FaFolderOpen, FaFile, FaChevronRight, FaChevronDown, FaSync } from 'react-icons/fa';
import { readDir } from '@tauri-apps/plugin-fs';
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

      // Reload tree
      const entries = await readDir(rootPath);
      const newTree = await buildTreeFromEntries(entries, '', expandedPaths);
      setTree(newTree);
    } catch (error) {
      console.error('Error refreshing tree:', error);
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
        .filter((entry: any) => !entry.name.startsWith('.'))
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
          .filter((entry: any) => !entry.name.startsWith('.')) // Filter hidden files
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


  const toggleDirectory = async (node: FileNode, parentPath: string[] = []) => {
    if (!node.isDirectory) {
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
      const children: FileNode[] = entries
        .filter((entry: any) => !entry.name.startsWith('.')) // Filter hidden files
        .map((entry: any) => ({
          name: entry.name,
          path: `${node.path}/${entry.name}`,
          isDirectory: entry.isDirectory || false,
          children: entry.isDirectory ? [] : undefined,
          isExpanded: false,
        }));

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

  const renderTree = (nodes: FileNode[], level: number = 0, parentPath: string[] = []): JSX.Element[] => {
    return nodes.map((node) => (
      <div key={node.path}>
        <div
          className="file-tree-item"
          style={{ paddingLeft: `${level * 20 + 10}px` }}
          onClick={() => toggleDirectory(node, parentPath)}
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
            <button 
              className="file-tree-refresh-btn" 
              onClick={refreshTree}
              disabled={isRefreshing}
              title="Refresh file tree"
            >
              <FaSync className={isRefreshing ? 'spinning' : ''} size={12} />
            </button>
          )}
        </div>
        {rootPath && (
          <div className="file-tree-path" title={rootPath}>
            {rootPath.split('/').pop() || 'Root'}
          </div>
        )}
      </div>
      <div className="file-tree-content">
        {tree.length === 0 && !loading ? (
          <div className="file-tree-empty">
            No folder opened. Click "Open Folder" to browse files.
          </div>
        ) : (
          renderTree(tree)
        )}
      </div>
    </div>
  );
};