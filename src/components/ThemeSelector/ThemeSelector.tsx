import React, { useState, useEffect } from 'react';
import { Palette } from 'lucide-react';
import './ThemeSelector.css';

export type EditorTheme = 'vs' | 'vs-dark' | 'hc-black' | 'hc-light';

interface ThemeSelectorProps {
  onThemeChange: (theme: EditorTheme) => void;
}

const themes: { value: EditorTheme; label: string }[] = [
  { value: 'vs-dark', label: 'Dark (Default)' },
  { value: 'vs', label: 'Light' },
  { value: 'hc-black', label: 'High Contrast Dark' },
  { value: 'hc-light', label: 'High Contrast Light' },
];

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ onThemeChange }) => {
  const [currentTheme, setCurrentTheme] = useState<EditorTheme>('vs-dark');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Load saved theme from localStorage
    const savedTheme = localStorage.getItem('editor-theme') as EditorTheme;
    if (savedTheme && themes.some(t => t.value === savedTheme)) {
      setCurrentTheme(savedTheme);
      onThemeChange(savedTheme);
    }
  }, [onThemeChange]);

  const handleThemeChange = (theme: EditorTheme) => {
    setCurrentTheme(theme);
    localStorage.setItem('editor-theme', theme);
    onThemeChange(theme);
    setIsOpen(false);
  };

  return (
    <div className="theme-selector">
      <button
        className="theme-selector-button"
        onClick={() => setIsOpen(!isOpen)}
        onBlur={(e) => {
          // Close dropdown when clicking outside
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setTimeout(() => setIsOpen(false), 200);
          }
        }}
      >
        <Palette size={16} />
        <span>Theme</span>
      </button>
      
      {isOpen && (
        <div className="theme-dropdown">
          {themes.map((theme) => (
            <button
              key={theme.value}
              className={`theme-option ${currentTheme === theme.value ? 'active' : ''}`}
              onClick={() => handleThemeChange(theme.value)}
            >
              {theme.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};