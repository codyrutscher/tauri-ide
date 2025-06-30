import React, { useEffect, useRef } from 'react';
import { FaFile, FaFolder, FaTrash, FaEdit } from 'react-icons/fa';
import './ContextMenu.css';

interface ContextMenuProps {
  x: number;
  y: number;
  isDirectory: boolean;
  onNewFile: () => void;
  onNewFolder: () => void;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
  showNewOptions?: boolean;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  isDirectory,
  onNewFile,
  onNewFolder,
  onRename,
  onDelete,
  onClose,
  showNewOptions = true,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        position: 'fixed',
        left: x,
        top: y,
      }}
    >
      {showNewOptions && (
        <>
          <div className="context-menu-item" onClick={onNewFile}>
            <FaFile size={12} />
            <span>New File</span>
          </div>
          <div className="context-menu-item" onClick={onNewFolder}>
            <FaFolder size={12} />
            <span>New Folder</span>
          </div>
          <div className="context-menu-divider" />
        </>
      )}
      <div className="context-menu-item" onClick={onRename}>
        <FaEdit size={12} />
        <span>Rename</span>
      </div>
      <div className="context-menu-item context-menu-item-danger" onClick={onDelete}>
        <FaTrash size={12} />
        <span>Delete</span>
      </div>
    </div>
  );
};