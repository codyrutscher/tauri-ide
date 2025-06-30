import React, { useState, useEffect, useRef } from 'react';
import './InputDialog.css';

interface InputDialogProps {
  title: string;
  placeholder: string;
  initialValue?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export const InputDialog: React.FC<InputDialogProps> = ({
  title,
  placeholder,
  initialValue = '',
  onConfirm,
  onCancel,
}) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onConfirm(value.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="input-dialog-overlay" onClick={onCancel}>
      <div className="input-dialog" onClick={e => e.stopPropagation()}>
        <h3 className="input-dialog-title">{title}</h3>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            className="input-dialog-input"
            placeholder={placeholder}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="input-dialog-buttons">
            <button type="button" className="input-dialog-btn input-dialog-btn-cancel" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="input-dialog-btn input-dialog-btn-confirm">
              OK
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};