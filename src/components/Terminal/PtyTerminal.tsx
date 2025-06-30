import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import '@xterm/xterm/css/xterm.css';
import './Terminal.css';

interface TerminalProps {
  workingDirectory?: string | null;
}

interface PtyOutputPayload {
  id: string;
  data: string;
}

export const Terminal: React.FC<TerminalProps> = ({ workingDirectory }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [ptyId, setPtyId] = useState<string | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const initTerminal = async () => {
      // Create xterm instance
      const term = new XTerm({
        theme: {
          background: '#1e1e1e',
          foreground: '#cccccc',
          cursor: '#ffffff',
          black: '#000000',
          red: '#cd3131',
          green: '#0dbc79',
          yellow: '#e5e510',
          blue: '#2472c8',
          magenta: '#bc3fbc',
          cyan: '#11a8cd',
          white: '#e5e5e5',
          brightBlack: '#666666',
          brightRed: '#f14c4c',
          brightGreen: '#23d18b',
          brightYellow: '#f5f543',
          brightBlue: '#3b8eea',
          brightMagenta: '#d670d6',
          brightCyan: '#29b8db',
          brightWhite: '#ffffff',
        },
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        cursorBlink: true,
        cursorStyle: 'block',
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      
      term.open(terminalRef.current);
      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      // Initial fit
      setTimeout(() => {
        fitAddon.fit();
      }, 0);

      // Get terminal dimensions
      const cols = term.cols;
      const rows = term.rows;

      try {
        // Spawn PTY
        const id = await invoke<string>('spawn_pty', {
          shell: null,
          cwd: workingDirectory,
          cols,
          rows,
        });
        
        setPtyId(id);
        console.log('PTY spawned with id:', id);

        // Listen for PTY output
        const unlisten = await listen<PtyOutputPayload>('pty-output', (event) => {
          if (event.payload.id === id) {
            term.write(event.payload.data);
          }
        });
        unlistenRef.current = unlisten;

        // Listen for PTY exit
        await listen<string>('pty-exit', (event) => {
          if (event.payload === id) {
            console.log('PTY exited:', id);
            term.write('\r\n[Process exited]\r\n');
          }
        });

        // Handle input - send to PTY
        term.onData((data) => {
          if (id) {
            invoke('write_to_pty', { id, data }).catch(console.error);
          }
        });

        // Handle resize
        const handleResize = () => {
          if (fitAddonRef.current && xtermRef.current && id) {
            try {
              fitAddonRef.current.fit();
              const newCols = xtermRef.current.cols;
              const newRows = xtermRef.current.rows;
              invoke('resize_pty', { id, cols: newCols, rows: newRows }).catch(console.error);
            } catch (e) {
              console.warn('Failed to resize terminal:', e);
            }
          }
        };
        
        window.addEventListener('resize', handleResize);
        term.onResize(({ cols, rows }) => {
          if (id) {
            invoke('resize_pty', { id, cols, rows }).catch(console.error);
          }
        });

        // Cleanup function
        return () => {
          window.removeEventListener('resize', handleResize);
          if (unlistenRef.current) {
            unlistenRef.current();
          }
          if (id) {
            invoke('kill_pty', { id }).catch(console.error);
          }
          term.dispose();
          xtermRef.current = null;
          fitAddonRef.current = null;
        };
      } catch (error) {
        console.error('Failed to spawn PTY:', error);
        term.write('\r\n\x1b[31mFailed to spawn terminal: ' + error + '\x1b[0m\r\n');
      }
    };

    const cleanup = initTerminal();

    return () => {
      cleanup.then(fn => fn && fn());
    };
  }, [workingDirectory]);

  return (
    <div className="terminal-container">
      <div className="terminal-header">
        <span>Terminal</span>
        <button
          className="terminal-clear-btn"
          onClick={() => {
            if (xtermRef.current) {
              xtermRef.current.clear();
            }
          }}
        >
          Clear
        </button>
      </div>
      <div ref={terminalRef} className="terminal-content" />
    </div>
  );
};